from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .db import iso, utcnow
from .models import AuditEvent, Order, OrderLine, Retailer, RetailerPrice, Sku, User
from .pricing import CASE, Item, OrderQuote, SchemeRule, quote_order

OPEN_STATUSES = ("PLACED", "CREDIT_HOLD", "CONFIRMED")
LOW_STOCK_CASES = 10


def audit(db: Session, user: User | None, action: str, detail: str = "") -> None:
    db.add(AuditEvent(user_id=user.id if user else None, action=action, detail=detail))


def rules_for(sku: Sku) -> tuple[SchemeRule, ...]:
    return tuple(SchemeRule(kind=s.kind, label=s.label, buy_qty=s.buy_qty, free_qty=s.free_qty, min_cases=s.min_cases,
                            discount_pct=s.discount_pct, valid_from=s.valid_from, valid_to=s.valid_to, active=s.active)
                 for s in sku.schemes)


def prices_for(db: Session, retailer_id: int) -> dict[int, Decimal]:
    return {p.sku_id: p.price for p in db.scalars(select(RetailerPrice).where(RetailerPrice.retailer_id == retailer_id))}


def item_for(sku: Sku, price: Decimal) -> Item:
    return Item(code=sku.code, units_per_case=sku.units_per_case, unit_price=price, gst_rate=sku.gst_rate,
                stock_cases=sku.stock_cases, schemes=rules_for(sku))


def quote_for(db: Session, retailer_id: int, lines: list[tuple[int, int, str]], lock: bool = False) -> tuple[OrderQuote, list[Sku]]:
    ids = [sku_id for sku_id, _, _ in lines]
    stmt = select(Sku).where(Sku.id.in_(ids)).options(selectinload(Sku.schemes))
    if lock:
        stmt = stmt.with_for_update()  # Postgres row locks so two orders can't take the same last cases
    skus = {s.id: s for s in db.scalars(stmt)}
    if missing := [i for i in ids if i not in skus]:
        raise HTTPException(404, f"Unknown product id(s): {missing}")
    prices = prices_for(db, retailer_id)
    quote = quote_order([(item_for(skus[i], prices.get(i, skus[i].dealer_price)), qty, unit) for i, qty, unit in lines],
                        date.today())
    return quote, [skus[i] for i in ids]


def exposure(db: Session, retailer: Retailer) -> Decimal:
    open_total = db.scalar(select(func.coalesce(func.sum(Order.total), 0)).where(
        Order.retailer_id == retailer.id, Order.status.in_(OPEN_STATUSES))) or 0
    return Decimal(retailer.outstanding) + Decimal(open_total)


def _next_number(db: Session) -> str:
    return f"ORD-{24000 + (db.scalar(select(func.max(Order.id))) or 0) + 1}"


def place_order(db: Session, retailer: Retailer, lines: list[tuple[int, int, str]], source: str, user: User,
                note: str | None = None) -> Order:
    merged: dict[tuple[int, str], int] = {}
    for sku_id, qty, unit in lines:
        merged[(sku_id, unit)] = merged.get((sku_id, unit), 0) + qty
    lines = [(sku_id, qty, unit) for (sku_id, unit), qty in merged.items()]
    quote, skus = quote_for(db, retailer.id, lines, lock=True)
    if quote.errors:
        raise HTTPException(409, {"message": "Some lines need attention", "errors": quote.errors})

    current = exposure(db, retailer)
    status, hold = "PLACED", None
    if current + quote.total > retailer.credit_limit:
        status = "CREDIT_HOLD"
        hold = (f"Credit limit ₹{retailer.credit_limit:,.0f} would be exceeded: outstanding and open orders "
                f"₹{current:,.2f} + this order ₹{quote.total:,.2f}")
    order = Order(number=_next_number(db), retailer_id=retailer.id, source=source, status=status,
                  subtotal=quote.subtotal, discount_total=quote.discount_total, gst_total=quote.gst_total,
                  total=quote.total, free_cases_total=quote.free_cases_total, hold_reason=hold, note=note,
                  created_by_id=user.id)
    for line, sku in zip(quote.lines, skus):
        sku.stock_cases -= line.reserved_cases + line.free_cases
        order.lines.append(OrderLine(sku_id=sku.id, unit=line.unit, qty=line.qty, reserved_cases=line.reserved_cases,
                                     free_cases=line.free_cases, unit_price=line.unit_price, gross=line.gross,
                                     discount=line.discount, gst=line.gst, total=line.total,
                                     scheme_note="; ".join(line.notes) or None))
    db.add(order)
    db.flush()
    audit(db, user, "order.placed", f"{order.number} {status} ₹{quote.total} via {source}")
    db.commit()
    return order


def release_stock(order: Order) -> None:
    for line in order.lines:
        line.sku.stock_cases += line.reserved_cases + line.free_cases


def load_order(db: Session, order_id: int) -> Order | None:
    return db.scalar(select(Order).where(Order.id == order_id).options(
        selectinload(Order.lines).selectinload(OrderLine.sku), selectinload(Order.retailer)))


def f(value) -> float:
    return float(value or 0)


def sku_json(sku: Sku, price: Decimal) -> dict:
    status = "OUT" if sku.stock_cases <= 0 else "LOW" if sku.stock_cases < LOW_STOCK_CASES else "IN"
    return {
        "id": sku.id, "code": sku.code, "name": sku.name, "brand": sku.brand.name, "category": sku.category,
        "pack": sku.pack_label, "units_per_case": sku.units_per_case, "price": f(price),
        "case_price": f(price * sku.units_per_case), "gst_rate": f(sku.gst_rate), "stock_cases": sku.stock_cases,
        "stock_status": status,
        "schemes": [s.label for s in sku.schemes if s.active and s.valid_from <= date.today() <= s.valid_to],
    }


def quote_json(quote: OrderQuote, skus: list[Sku]) -> dict:
    return {
        "lines": [{
            "sku_id": sku.id, "code": sku.code, "name": sku.name, "pack": sku.pack_label, "unit": l.unit, "qty": l.qty,
            "units_per_case": sku.units_per_case, "free_cases": l.free_cases, "unit_price": f(l.unit_price),
            "gross": f(l.gross), "discount": f(l.discount), "gst": f(l.gst), "gst_rate": f(sku.gst_rate),
            "total": f(l.total), "notes": l.notes, "errors": l.errors, "hint": l.hint,
        } for l, sku in zip(quote.lines, skus)],
        "subtotal": f(quote.subtotal), "discount_total": f(quote.discount_total), "gst_total": f(quote.gst_total),
        "total": f(quote.total), "free_cases_total": quote.free_cases_total, "errors": quote.errors,
    }


def order_json(order: Order, with_lines: bool = False) -> dict:
    data = {
        "id": order.id, "number": order.number, "status": order.status, "source": order.source,
        "retailer": {"id": order.retailer.id, "code": order.retailer.code, "shop_name": order.retailer.shop_name,
                     "area": order.retailer.area},
        "subtotal": f(order.subtotal), "discount_total": f(order.discount_total), "gst_total": f(order.gst_total),
        "total": f(order.total), "free_cases_total": order.free_cases_total, "hold_reason": order.hold_reason,
        "note": order.note, "created_at": iso(order.created_at), "confirmed_at": iso(order.confirmed_at),
        "exported_at": iso(order.exported_at), "line_count": len(order.lines),
    }
    if with_lines:
        data["lines"] = [{
            "sku_id": l.sku_id, "code": l.sku.code, "name": l.sku.name, "pack": l.sku.pack_label, "unit": l.unit,
            "qty": l.qty, "free_cases": l.free_cases, "unit_price": f(l.unit_price), "gross": f(l.gross),
            "discount": f(l.discount), "gst": f(l.gst), "total": f(l.total), "scheme_note": l.scheme_note,
        } for l in order.lines]
    return data


def set_status(db: Session, order: Order, user: User, action: str) -> Order:
    allowed = {"confirm": ("PLACED",), "release": ("CREDIT_HOLD",), "cancel": OPEN_STATUSES}
    if order.status not in allowed[action]:
        raise HTTPException(409, f"Can't {action} an order that is {order.status.replace('_', ' ').lower()}")
    if action == "cancel":
        release_stock(order)
        order.status = "CANCELLED"
    else:
        order.status, order.confirmed_at = "CONFIRMED", utcnow()
    audit(db, user, f"order.{action}", order.number)
    db.commit()
    return order


def unit_label(unit: str) -> str:
    return "case" if unit == CASE else "piece"
