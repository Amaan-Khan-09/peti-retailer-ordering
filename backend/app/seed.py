"""Realistic sample data for Company A, Jabalpur. All names and numbers are fictional.

The three SKUs and the raw order message from the brief are included as given; the rest is invented to make the
catalogue, history and dashboard feel real. Run `python -m app.seed --reset` to rebuild from scratch.
"""
import random
import sys
from dataclasses import replace
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine, utcnow
from .models import Brand, InboundMessage, Order, OrderLine, Retailer, RetailerPrice, Scheme, Sku, User
from .orders import item_for
from .pricing import CASE, quote_order

D = Decimal
# code, name, brand, category, line, pack, size (g/ml), units/case, price/piece, gst %, stock cases, keywords
SKUS = [
    ("SKU-BS-075", "Glucose biscuit 75 g", 0, "Biscuits", "Glucose biscuit", "75 g", 75, 96, "8.10", 18, 340, "glucose biscuit"),
    ("SKU-BS-200", "Glucose biscuit 200 g", 0, "Biscuits", "Glucose biscuit", "200 g", 200, 48, "22.50", 18, 120, "glucose biscuit"),
    ("SKU-CR-060", "Cream biscuit 60 g", 0, "Biscuits", "Cream biscuit", "60 g", 60, 120, "9.20", 18, 210, "cream biscuit"),
    ("SKU-CR-150", "Cream biscuit 150 g", 0, "Biscuits", "Cream biscuit", "150 g", 150, 48, "27.00", 18, 64, "cream biscuit"),
    ("SKU-MR-100", "Marie biscuit 100 g", 0, "Biscuits", "Marie biscuit", "100 g", 100, 72, "11.40", 18, 150, "marie biscuit"),
    ("SKU-SN-050", "Salted snack crackers 50 g", 0, "Biscuits", "Snack crackers", "50 g", 50, 120, "4.60", 18, 6, "snack cracker salted namkeen"),
    ("SKU-DT-1KG", "Detergent powder 1 kg", 1, "Home care", "Detergent powder", "1 kg", 1000, 20, "101.50", 18, 85, "detergent powder washing"),
    ("SKU-DT-500", "Detergent powder 500 g", 1, "Home care", "Detergent powder", "500 g", 500, 40, "52.00", 18, 110, "detergent powder washing"),
    ("SKU-DB-200", "Detergent bar 200 g", 1, "Home care", "Detergent bar", "200 g", 200, 50, "18.50", 18, 200, "detergent bar"),
    ("SKU-DW-500", "Dishwash liquid 500 ml", 1, "Home care", "Dishwash liquid", "500 ml", 500, 24, "89.00", 18, 46, "dishwash liquid"),
    ("SKU-FC-500", "Floor cleaner 500 ml", 1, "Home care", "Floor cleaner", "500 ml", 500, 24, "76.00", 18, 12, "floor cleaner"),
    ("SKU-TE-250", "Tea leaf 250 g", 2, "Tea", "Tea leaf", "250 g", 250, 40, "118.00", 5, 0, "tea leaf"),
    ("SKU-TE-500", "Tea leaf 500 g", 2, "Tea", "Tea leaf", "500 g", 500, 24, "228.00", 5, 38, "tea leaf"),
    ("SKU-TE-1KG", "Tea leaf 1 kg", 2, "Tea", "Tea leaf", "1 kg", 1000, 12, "440.00", 5, 22, "tea leaf"),
    ("SKU-TD-100", "Tea dust 100 g", 2, "Tea", "Tea dust", "100 g", 100, 100, "27.50", 5, 90, "tea dust"),
    ("SKU-SP-100", "Bath soap 100 g", 3, "Personal care", "Bath soap", "100 g", 100, 144, "24.00", 18, 75, "bath soap"),
    ("SKU-SH-180", "Shampoo 180 ml", 3, "Personal care", "Shampoo", "180 ml", 180, 48, "95.00", 18, 30, "shampoo"),
    ("SKU-TP-150", "Toothpaste 150 g", 3, "Personal care", "Toothpaste", "150 g", 150, 72, "58.00", 18, 54, "toothpaste"),
]
# sku code, kind, label, buy, free, min cases, discount %
SCHEMES = [
    ("SKU-BS-075", "FREE_GOODS", "Buy 10 cases get 1 free", 10, 1, None, None),
    ("SKU-DT-1KG", "SLAB_DISCOUNT", "3% off 5 or more cases", None, None, 5, "3"),
    ("SKU-CR-060", "SLAB_DISCOUNT", "2% off 10 or more cases", None, None, 10, "2"),
    ("SKU-DB-200", "FREE_GOODS", "Buy 20 cases get 1 free", 20, 1, None, None),
    ("SKU-TE-1KG", "SLAB_DISCOUNT", "2% off 3 or more cases", None, None, 3, "2"),
    ("SKU-TE-1KG", "SLAB_DISCOUNT", "4% off 6 or more cases", None, None, 6, "4"),
    ("SKU-SP-100", "FREE_GOODS", "Buy 10 cases get 1 free", 10, 1, None, None),
    ("SKU-TP-150", "SLAB_DISCOUNT", "4% off 5 or more cases", None, None, 5, "4"),
]
# shop, owner, area, credit limit, outstanding, days since last order (None = never)
RETAILERS = [
    ("Sharma Kirana Store", "Ramesh Sharma", "Napier Town", 150000, 42000, 3),
    ("Gupta General Store", "Anil Gupta", "Wright Town", 40000, 36500, 6),
    ("Patel Provision", "Kiran Patel", "Adhartal", 90000, 18000, 2),
    ("Jain Traders", "Sanjay Jain", "Sadar", 120000, 51000, 1),
    ("Yadav Kirana", "Sunil Yadav", "Garha", 60000, 9000, 4),
    ("Khan General Store", "Salim Khan", "Gohalpur", 75000, 22000, 5),
    ("Verma Daily Needs", "Pooja Verma", "Madan Mahal", 50000, 12000, 19),
    ("Soni Kirana", "Rakesh Soni", "Ranjhi", 45000, 30000, 23),
    ("Tiwari Stores", "Alok Tiwari", "Vijay Nagar", 80000, 15000, 2),
    ("Dubey Provision", "Manoj Dubey", "Gorakhpur", 70000, 41000, 16),
    ("Agrawal Kirana", "Neha Agrawal", "Gwarighat", 100000, 27000, 7),
    ("Sahu General", "Deepak Sahu", "Karmeta", 35000, 8000, 31),
    ("Mishra Stores", "Vivek Mishra", "Shastri Nagar", 65000, 19000, 3),
    ("Rajput Kirana", "Vikram Rajput", "Tilwara", 40000, 5000, 15),
    ("Ansari Traders", "Imran Ansari", "Ghamapur", 85000, 38000, 1),
    ("Chouksey Kirana", "Rahul Chouksey", "Kanchghar", 55000, 14000, 9),
    ("Namdev Stores", "Seema Namdev", "Bilhari", 30000, 3000, None),
    ("Pandey General", "Ajay Pandey", "Medical Road", 95000, 33000, 4),
    ("Kushwaha Kirana", "Ravi Kushwaha", "Panagar Road", 45000, 21000, 27),
    ("Rao Provision", "Lakshmi Rao", "Cantt", 70000, 16000, 8),
]
MESSAGES = [
    (0, "bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti", 35),
    (1, "Namaste ji. 10 peti marie biscuit, 3 dabba bartan liquid, toothpaste 5 peti", 80),
    (2, "Bhai 2 case tea 1kg aur 12 packet shampoo", 140),
    (5, "3 peti sabun, 1 peti phenyl, 4 peti namkeen", 220),
    (3, "please send 6 cases cream biscuit big and 2 cases detergent bar", 300),
    (4, "5 पेटी बिस्कुट छोटा और 2 पेटी चाय पत्ती 500 वाला", 410),
]
DESK_PHONE, RETAILER_PHONES = "9000000001", ["9000000101", "9000000102"]


def seed(db: Session) -> None:
    rng = random.Random(42)
    today = date.today()
    brands = [Brand(name=n) for n in ("Brand K (biscuits)", "Brand L (home care)", "Brand M (tea)", "Brand N (personal care)")]
    db.add_all(brands)
    skus = {}
    for code, name, brand, category, line, pack, size, upc, price, gst, stock, keywords in SKUS:
        skus[code] = Sku(code=code, name=name, brand=brands[brand], category=category, line=line, pack_label=pack,
                         size_value=size, units_per_case=upc, dealer_price=D(price), gst_rate=D(gst),
                         stock_cases=stock, keywords=keywords)
    db.add_all(skus.values())
    for code, kind, label, buy, free, min_cases, pct in SCHEMES:
        db.add(Scheme(sku=skus[code], kind=kind, label=label, buy_qty=buy, free_qty=free, min_cases=min_cases,
                      discount_pct=D(pct) if pct else None, valid_from=today - timedelta(days=10),
                      valid_to=today + timedelta(days=80)))

    retailers = []
    for i, (shop, owner, area, limit, outstanding, _) in enumerate(RETAILERS):
        retailers.append(Retailer(code=f"RET-{101 + i}", shop_name=shop, owner_name=owner, area=area,
                                  phone=f"90000{i + 101:05d}", credit_limit=D(limit), outstanding=D(outstanding)))
    db.add_all(retailers)
    db.flush()
    # Special prices for the first shop, so "your price" is visibly per retailer.
    db.add_all([RetailerPrice(retailer_id=retailers[0].id, sku_id=skus["SKU-BS-075"].id, price=D("8.00")),
                RetailerPrice(retailer_id=retailers[0].id, sku_id=skus["SKU-DT-1KG"].id, price=D("99.80"))])

    desk = User(phone=DESK_PHONE, name="Order desk (Meena)", role="desk")
    db.add(desk)
    for phone, retailer in zip(RETAILER_PHONES, retailers):
        db.add(User(phone=phone, name=retailer.owner_name, role="retailer", retailer_id=retailer.id))
    for retailer in retailers[2:]:
        db.add(User(phone=retailer.phone, name=retailer.owner_name, role="retailer", retailer_id=retailer.id))
    db.flush()

    # Order history: deliveries already exported to Tally, plus a few open orders for the desk.
    number = 24000
    usual = {r.id: rng.sample(list(skus.values()), 4) for r in retailers}
    usual[retailers[0].id][0] = skus["SKU-BS-075"]  # the brief's sample message comes from this shop
    for retailer, (*_, last_days) in zip(retailers, RETAILERS):
        if last_days is None:
            continue
        day = last_days
        while day <= last_days + 45:
            # Past deliveries: priced with the same engine, but not limited by today's stock.
            lines = [(replace(item_for(s, s.dealer_price), stock_cases=10**6), rng.choice([1, 2, 3, 5, 10]), CASE)
                     for s in rng.sample(usual[retailer.id], rng.randint(2, 4))]
            quote = quote_order(lines, today)
            created = utcnow() - timedelta(days=day, hours=rng.randint(1, 9))
            status = "EXPORTED" if day > 2 else "CONFIRMED" if day == 2 else "PLACED"
            number += 1
            order = Order(number=f"ORD-{number}", retailer_id=retailer.id, source=rng.choice(["app", "salesman", "ai_capture"]),
                          status=status, subtotal=quote.subtotal, discount_total=quote.discount_total,
                          gst_total=quote.gst_total, total=quote.total, free_cases_total=quote.free_cases_total,
                          created_at=created, created_by_id=desk.id,
                          confirmed_at=created if status != "PLACED" else None,
                          exported_at=created + timedelta(hours=20) if status == "EXPORTED" else None)
            sku_by_code = {s.code: s for s in skus.values()}
            for lq in quote.lines:
                order.lines.append(OrderLine(sku_id=sku_by_code[lq.code].id, unit=lq.unit, qty=lq.qty,
                                             reserved_cases=lq.reserved_cases, free_cases=lq.free_cases,
                                             unit_price=lq.unit_price, gross=lq.gross, discount=lq.discount,
                                             gst=lq.gst, total=lq.total, scheme_note="; ".join(lq.notes) or None))
            db.add(order)
            day += rng.randint(6, 12)
    db.flush()

    for index, text, minutes_ago in MESSAGES:
        db.add(InboundMessage(retailer_id=retailers[index].id, text=text, received_at=utcnow() - timedelta(minutes=minutes_ago)))
    db.commit()


def reset() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset()
        print("Database rebuilt with sample data.")
