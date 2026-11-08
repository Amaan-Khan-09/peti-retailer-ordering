"""Salesman mode: one download per day of everything needed to take orders on the beat without signal."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..auth import require_salesman
from ..db import get_db, iso, utcnow
from ..models import Order, Retailer, RetailerPrice, Sku, User
from ..orders import exposure, f, live_schemes, scheme_json
from ..suggest import suggestions

router = APIRouter(prefix="/api/salesman", tags=["salesman"])


@router.get("/bundle")
def bundle(user: User = Depends(require_salesman), db: Session = Depends(get_db)):
    shops = list(db.scalars(select(Retailer).where(Retailer.salesman_id == user.id).order_by(Retailer.area, Retailer.shop_name)))
    ids = [s.id for s in shops]
    overrides: dict[int, dict[str, float]] = {i: {} for i in ids}
    for p in db.scalars(select(RetailerPrice).where(RetailerPrice.retailer_id.in_(ids))):
        overrides[p.retailer_id][str(p.sku_id)] = f(p.price)
    last = dict(db.execute(select(Order.retailer_id, func.max(Order.created_at)).where(
        Order.retailer_id.in_(ids), Order.status != "CANCELLED").group_by(Order.retailer_id)).all()) if ids else {}
    skus = db.scalars(select(Sku).options(selectinload(Sku.schemes), selectinload(Sku.brand)).order_by(Sku.category, Sku.name))
    return {
        "generated_at": iso(utcnow()),
        "salesman": user.name,
        "shops": [{
            "id": s.id, "code": s.code, "shop_name": s.shop_name, "owner_name": s.owner_name, "area": s.area,
            "phone": s.phone, "credit_limit": f(s.credit_limit), "credit_used": f(exposure(db, s)),
            "credit_available": f(max(s.credit_limit - exposure(db, s), 0)), "last_order_at": iso(last.get(s.id)),
            "prices": overrides[s.id], "suggestions": suggestions(db, s.id),
        } for s in shops],
        "skus": [{
            "id": s.id, "code": s.code, "name": s.name, "name_hi": s.name_hi, "brand": s.brand.name,
            "category": s.category, "pack": s.pack_label, "units_per_case": s.units_per_case,
            "dealer_price": f(s.dealer_price), "gst_rate": f(s.gst_rate), "mrp": f(s.mrp), "stock_cases": s.stock_cases,
            "schemes": [scheme_json(x) for x in live_schemes(s)],
        } for s in skus],
    }
