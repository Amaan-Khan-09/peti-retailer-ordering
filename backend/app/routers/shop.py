"""Catalogue, quotes and orders. Retailers only ever see their own prices, credit and orders."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..auth import current_user, require_retailer
from ..db import get_db
from ..models import Order, OrderLine, Retailer, Sku, User
from ..orders import load_order, order_json, place_order, prices_for, quote_for, quote_json, sku_json
from ..schemas import PlaceOrderRequest, QuoteRequest

router = APIRouter(prefix="/api", tags=["shop"])


def retailer_scope(user: User, retailer_id: int | None, db: Session) -> Retailer:
    """A retailer is pinned to their own shop; the desk must say which shop it is acting for."""
    if user.role == "retailer":
        return user.retailer
    if retailer_id is None:
        raise HTTPException(400, "Choose a retailer")
    retailer = db.get(Retailer, retailer_id)
    if not retailer:
        raise HTTPException(404, "Retailer not found")
    return retailer


@router.get("/catalogue")
def catalogue(retailer_id: int | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    retailer = retailer_scope(user, retailer_id, db)
    prices = prices_for(db, retailer.id)
    skus = db.scalars(select(Sku).options(selectinload(Sku.schemes), selectinload(Sku.brand)).order_by(Sku.category, Sku.name))
    return {"retailer_id": retailer.id, "items": [sku_json(s, prices.get(s.id, s.dealer_price)) for s in skus]}


@router.post("/quote")
def quote(body: QuoteRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    retailer = retailer_scope(user, body.retailer_id, db)
    result, skus = quote_for(db, retailer.id, [(l.sku_id, l.qty, l.unit) for l in body.lines])
    return quote_json(result, skus)


@router.post("/orders", status_code=201)
def create_order(body: PlaceOrderRequest, user: User = Depends(require_retailer), db: Session = Depends(get_db)):
    order = place_order(db, user.retailer, [(l.sku_id, l.qty, l.unit) for l in body.lines], "app", user, body.note)
    return order_json(load_order(db, order.id), with_lines=True)


@router.get("/orders")
def list_orders(status: str | None = None, q: str | None = Query(default=None, max_length=60),
                user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Order).options(selectinload(Order.retailer), selectinload(Order.lines)).order_by(Order.created_at.desc())
    if user.role == "retailer":
        stmt = stmt.where(Order.retailer_id == user.retailer_id)
    if status:
        stmt = stmt.where(Order.status.in_(status.split(",")))
    if q and user.role == "desk":
        like = f"%{q.strip()}%"
        stmt = stmt.join(Retailer).where(Order.number.ilike(like) | Retailer.shop_name.ilike(like) | Retailer.code.ilike(like))
    return [order_json(o) for o in db.scalars(stmt.limit(200))]


@router.get("/orders/repeat")
def repeat_lines(user: User = Depends(require_retailer), db: Session = Depends(get_db)):
    last = db.scalar(select(Order).where(Order.retailer_id == user.retailer_id, Order.status != "CANCELLED")
                     .order_by(Order.created_at.desc()).options(selectinload(Order.lines)))
    if not last:
        return {"order_number": None, "lines": []}
    return {"order_number": last.number, "lines": [{"sku_id": l.sku_id, "qty": l.qty, "unit": l.unit} for l in last.lines]}


@router.get("/orders/{order_id}")
def get_order(order_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    order = load_order(db, order_id)
    if not order or (user.role == "retailer" and order.retailer_id != user.retailer_id):
        raise HTTPException(404, "Order not found")
    return order_json(order, with_lines=True)
