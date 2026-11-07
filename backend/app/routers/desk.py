"""Order desk: WhatsApp inbox, AI capture review, order actions, Tally export and the dashboard."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..auth import require_desk
from ..capture.service import confirm_capture, load_capture, run_capture
from ..db import get_db, iso, utcnow
from ..models import Capture, InboundMessage, Order, OrderLine, Retailer, Sku, User
from ..orders import audit, exposure, f, load_order, order_json, set_status
from ..schemas import ConfirmCapture, ExportRequest, NewMessage
from ..tally import to_csv, to_xml

router = APIRouter(prefix="/api/desk", tags=["desk"], dependencies=[Depends(require_desk)])


def message_json(m: InboundMessage, capture_id: int | None = None) -> dict:
    return {"id": m.id, "text": m.text, "channel": m.channel, "status": m.status, "received_at": iso(m.received_at),
            "order_id": m.order_id, "capture_id": capture_id,
            "retailer": {"id": m.retailer.id, "code": m.retailer.code, "shop_name": m.retailer.shop_name, "area": m.retailer.area}}


def capture_json(db: Session, capture: Capture) -> dict:
    ids = {i for line in capture.lines for i in [line.suggested_sku_id, *line.alternatives] if i}
    skus = {s.id: s for s in db.scalars(select(Sku).where(Sku.id.in_(ids)))} if ids else {}

    def brief(sku_id):
        s = skus.get(sku_id)
        return {"id": s.id, "code": s.code, "name": s.name, "pack": s.pack_label, "stock_cases": s.stock_cases,
                "units_per_case": s.units_per_case} if s else None

    return {
        "id": capture.id, "status": capture.status, "engine": capture.engine, "warnings": capture.warnings,
        "created_at": iso(capture.created_at), "message": message_json(capture.message, capture.id),
        "lines": [{"id": l.id, "raw_text": l.raw_text, "phrase": l.phrase, "qty": l.qty, "unit": l.unit,
                   "size_hint": l.size_hint, "confidence": l.confidence, "level": l.level, "reasons": l.reasons,
                   "suggested": brief(l.suggested_sku_id), "alternatives": [b for b in map(brief, l.alternatives) if b]}
                  for l in capture.lines],
    }


@router.get("/retailers")
def retailers(db: Session = Depends(get_db)):
    return [{"id": r.id, "code": r.code, "shop_name": r.shop_name, "area": r.area}
            for r in db.scalars(select(Retailer).order_by(Retailer.shop_name))]


@router.get("/messages")
def messages(status: str | None = "NEW,CAPTURED", db: Session = Depends(get_db)):
    stmt = select(InboundMessage).options(selectinload(InboundMessage.retailer)).order_by(InboundMessage.received_at.desc())
    if status:
        stmt = stmt.where(InboundMessage.status.in_(status.split(",")))
    found = list(db.scalars(stmt.limit(100)))
    drafts = {c.message_id: c.id for c in db.scalars(select(Capture).where(
        Capture.message_id.in_([m.id for m in found]), Capture.status == "DRAFT"))} if found else {}
    return [message_json(m, drafts.get(m.id)) for m in found]


@router.post("/messages", status_code=201)
def add_message(body: NewMessage, user: User = Depends(require_desk), db: Session = Depends(get_db)):
    """Stands in for the WhatsApp webhook (messaging is mocked in this build)."""
    if not db.get(Retailer, body.retailer_id):
        raise HTTPException(404, "Retailer not found")
    message = InboundMessage(retailer_id=body.retailer_id, text=body.text.strip())
    db.add(message)
    db.flush()
    audit(db, user, "message.added", f"message {message.id}")
    db.commit()
    db.refresh(message)
    return message_json(message)


@router.post("/messages/{message_id}/dismiss")
def dismiss(message_id: int, user: User = Depends(require_desk), db: Session = Depends(get_db)):
    message = db.get(InboundMessage, message_id)
    if not message:
        raise HTTPException(404, "Message not found")
    message.status = "DISMISSED"
    audit(db, user, "message.dismissed", str(message_id))
    db.commit()
    return {"ok": True}


@router.post("/messages/{message_id}/capture", status_code=201)
def capture(message_id: int, user: User = Depends(require_desk), db: Session = Depends(get_db)):
    message = db.get(InboundMessage, message_id)
    if not message:
        raise HTTPException(404, "Message not found")
    if message.status == "ORDERED":
        raise HTTPException(409, "This message is already an order")
    existing = db.scalar(select(Capture).where(Capture.message_id == message_id, Capture.status == "DRAFT"))
    if existing:
        db.delete(existing)  # re-read replaces the old draft
        db.flush()
    created = run_capture(db, message, user)
    return capture_json(db, load_capture(db, created.id))


@router.get("/captures/{capture_id}")
def get_capture(capture_id: int, db: Session = Depends(get_db)):
    found = load_capture(db, capture_id)
    if not found:
        raise HTTPException(404, "Draft not found")
    return capture_json(db, found)


@router.post("/captures/{capture_id}/confirm", status_code=201)
def confirm(capture_id: int, body: ConfirmCapture, user: User = Depends(require_desk), db: Session = Depends(get_db)):
    found = load_capture(db, capture_id)
    if not found:
        raise HTTPException(404, "Draft not found")
    order, learned = confirm_capture(db, found, body.lines, user)
    return {"order": order_json(load_order(db, order.id), with_lines=True), "learned": learned}


@router.post("/orders/{order_id}/{action}")
def order_action(order_id: int, action: str, user: User = Depends(require_desk), db: Session = Depends(get_db)):
    if action not in ("confirm", "release", "cancel"):
        raise HTTPException(404, "Unknown action")
    order = load_order(db, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order_json(set_status(db, order, user, action), with_lines=True)


@router.post("/export")
def export(body: ExportRequest, user: User = Depends(require_desk), db: Session = Depends(get_db)):
    stmt = select(Order).where(Order.status == "CONFIRMED").options(
        selectinload(Order.lines).selectinload(OrderLine.sku), selectinload(Order.retailer)).order_by(Order.created_at)
    if body.order_ids:
        stmt = stmt.where(Order.id.in_(body.order_ids))
    orders = list(db.scalars(stmt))
    if not orders:
        raise HTTPException(409, "No confirmed orders to export. Confirm orders first.")
    content = to_xml(orders) if body.format == "xml" else to_csv(orders)
    stamp = utcnow()
    for order in orders:
        order.status, order.exported_at = "EXPORTED", stamp
    audit(db, user, "tally.export", ", ".join(o.number for o in orders))
    db.commit()
    filename = f"peti-tally-{stamp:%Y%m%d-%H%M}.{body.format}"
    media = "application/xml" if body.format == "xml" else "text/csv"
    return Response(content, media_type=media, headers={"Content-Disposition": f'attachment; filename="{filename}"',
                                                        "X-Exported-Count": str(len(orders))})


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    now = utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = now - timedelta(days=7)
    count = lambda *conditions: db.scalar(select(func.count(Order.id)).where(*conditions)) or 0  # noqa: E731
    last_orders = dict(db.execute(select(Order.retailer_id, func.max(Order.created_at))
                                  .where(Order.status != "CANCELLED").group_by(Order.retailer_id)).all())
    quiet = []
    for r in db.scalars(select(Retailer)):
        last = last_orders.get(r.id)
        days = (now - last).days if last else None
        if days is None or days >= 14:
            quiet.append({"id": r.id, "code": r.code, "shop_name": r.shop_name, "owner_name": r.owner_name,
                          "area": r.area, "phone": r.phone, "days_since_order": days, "last_order_at": iso(last),
                          "credit_available": f(max(r.credit_limit - exposure(db, r), 0))})
    quiet.sort(key=lambda x: -(x["days_since_order"] or 9999))
    week_total = count(Order.created_at >= week, Order.status != "CANCELLED")
    week_ai = count(Order.created_at >= week, Order.status != "CANCELLED", Order.source == "ai_capture")
    return {
        "orders_today": count(Order.created_at >= today_start, Order.status != "CANCELLED"),
        "to_confirm": count(Order.status == "PLACED"),
        "credit_holds": count(Order.status == "CREDIT_HOLD"),
        "ready_for_tally": count(Order.status == "CONFIRMED"),
        "new_messages": db.scalar(select(func.count(InboundMessage.id)).where(InboundMessage.status.in_(("NEW", "CAPTURED")))) or 0,
        "ai_share_week": round(100 * week_ai / week_total) if week_total else 0,
        "out_of_stock": [{"code": s.code, "name": s.name} for s in db.scalars(select(Sku).where(Sku.stock_cases <= 0))],
        "quiet_retailers": quiet,
    }
