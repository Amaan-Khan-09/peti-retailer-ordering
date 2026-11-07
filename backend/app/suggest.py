"""Suggested order: the shop's regular products, with when each is due, from its own buying rhythm.

For each product bought at least twice in the last 120 days: the average gap between orders and the usual (median)
quantity. due_in_days = usual gap - days since it was last bought; 0 or less means due now. Due items come first,
and out-of-stock items last, so the shop sees why a regular is missing instead of it silently disappearing.
"""
from collections import defaultdict
from datetime import timedelta
from statistics import mean, median

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import utcnow
from .models import Order, OrderLine, Sku

LOOKBACK_DAYS = 120


def suggestions(db: Session, retailer_id: int, limit: int = 6) -> list[dict]:
    rows = db.execute(
        select(OrderLine.sku_id, OrderLine.qty, OrderLine.unit, Order.created_at, Sku.units_per_case, Sku.stock_cases)
        .join(Order, OrderLine.order_id == Order.id).join(Sku, OrderLine.sku_id == Sku.id)
        .where(Order.retailer_id == retailer_id, Order.status != "CANCELLED",
               Order.created_at >= utcnow() - timedelta(days=LOOKBACK_DAYS))).all()
    bought: dict[int, list] = defaultdict(list)
    stock: dict[int, int] = {}
    for sku_id, qty, unit, created, units_per_case, stock_cases in rows:
        bought[sku_id].append((created.date(), qty if unit == "CASE" else qty / units_per_case))
        stock[sku_id] = stock_cases

    today = utcnow().date()
    regulars = []
    for sku_id, buys in bought.items():
        days = sorted({d for d, _ in buys})
        if len(days) < 2:
            continue
        every = max(1, round(mean((b - a).days for a, b in zip(days, days[1:]))))
        since = (today - days[-1]).days
        qty = max(1, round(median(cases for _, cases in buys)))
        in_stock = stock[sku_id] > 0
        regulars.append({"sku_id": sku_id, "qty": min(qty, stock[sku_id]) if in_stock else qty, "unit": "CASE",
                         "every_days": every, "days_since": since, "due_in_days": every - since, "in_stock": in_stock})
    regulars.sort(key=lambda s: (not s["in_stock"], s["due_in_days"]))
    return regulars[:limit]
