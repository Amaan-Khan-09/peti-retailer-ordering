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
from pathlib import Path

from .models import (Brand, Capture, CaptureLine, InboundMessage, Order, OrderLine, Retailer, RetailerPrice, Scheme, Sku,
                     User)
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
NAMES_HI = {
    "SKU-BS-075": "ग्लूकोज़ बिस्कुट 75 ग्रा", "SKU-BS-200": "ग्लूकोज़ बिस्कुट 200 ग्रा", "SKU-CR-060": "क्रीम बिस्कुट 60 ग्रा",
    "SKU-CR-150": "क्रीम बिस्कुट 150 ग्रा", "SKU-MR-100": "मैरी बिस्कुट 100 ग्रा", "SKU-SN-050": "नमकीन क्रैकर्स 50 ग्रा",
    "SKU-DT-1KG": "डिटर्जेंट पाउडर 1 किलो", "SKU-DT-500": "डिटर्जेंट पाउडर 500 ग्रा", "SKU-DB-200": "डिटर्जेंट बार 200 ग्रा",
    "SKU-DW-500": "बर्तन धोने का लिक्विड 500 मि.ली.", "SKU-FC-500": "फ़्लोर क्लीनर 500 मि.ली.", "SKU-TE-250": "चाय पत्ती 250 ग्रा",
    "SKU-TE-500": "चाय पत्ती 500 ग्रा", "SKU-TE-1KG": "चाय पत्ती 1 किलो", "SKU-TD-100": "चाय डस्ट 100 ग्रा",
    "SKU-SP-100": "नहाने का साबुन 100 ग्रा", "SKU-SH-180": "शैम्पू 180 मि.ली.", "SKU-TP-150": "टूथपेस्ट 150 ग्रा",
}


def mrp(price: str, gst: int) -> Decimal:
    """Invented printed MRP: about a 12% shop margin on the standard price, rounded up to the rupee."""
    return (D(price) * (100 + gst) / 100 * D("1.14")).quantize(D("1"), rounding="ROUND_CEILING")


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
SALESMAN_PHONES = ["9000000201", "9000000202"]  # Rakesh covers the first 10 shops, Imran the next 10
MEDIA = Path(__file__).parent / "sample_media"
# (shop index, kind, file, minutes ago): a Hindi voice note and a photo of a handwritten list, as forwarded on WhatsApp
MEDIA_MESSAGES = [(4, "voice", "voice_note.mp3", "audio/mpeg", 25), (2, "photo", "handwritten_list.jpg", "image/jpeg", 50)]


def seed(db: Session) -> None:
    rng = random.Random(42)
    today = date.today()
    brands = [Brand(name=n) for n in ("Brand K (biscuits)", "Brand L (home care)", "Brand M (tea)", "Brand N (personal care)")]
    db.add_all(brands)
    skus = {}
    for code, name, brand, category, line, pack, size, upc, price, gst, stock, keywords in SKUS:
        skus[code] = Sku(code=code, name=name, name_hi=NAMES_HI[code], brand=brands[brand], category=category, line=line, pack_label=pack,
                         size_value=size, units_per_case=upc, dealer_price=D(price), gst_rate=D(gst), mrp=mrp(price, gst),
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
    salesmen = [User(phone=SALESMAN_PHONES[0], name="Rakesh Tiwari", role="salesman"),
                User(phone=SALESMAN_PHONES[1], name="Imran Qureshi", role="salesman")]
    db.add_all(salesmen)
    db.flush()
    for i, retailer in enumerate(retailers):
        retailer.salesman_id = salesmen[0 if i < 10 else 1].id

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
            # Older orders were mostly typed by the office; digital orders grow over recent weeks.
            digital = 0.75 if day <= 14 else 0.55 if day <= 30 else 0.3
            source = rng.choice(["app", "salesman", "ai_capture"]) if rng.random() < digital else "desk_entry"
            confirmed = (utcnow() - timedelta(hours=rng.randint(1, 3)) if status == "CONFIRMED"
                         else created + timedelta(hours=2) if status == "EXPORTED" else None)
            number += 1
            order = Order(number=f"ORD-{number}", retailer_id=retailer.id, source=source,
                          status=status, subtotal=quote.subtotal, discount_total=quote.discount_total,
                          gst_total=quote.gst_total, total=quote.total, free_cases_total=quote.free_cases_total,
                          created_at=created, created_by_id=desk.id,
                          confirmed_at=confirmed,
                          exported_at=created + timedelta(hours=20) if status == "EXPORTED" else None)
            sku_by_code = {s.code: s for s in skus.values()}
            for lq in quote.lines:
                order.lines.append(OrderLine(sku_id=sku_by_code[lq.code].id, unit=lq.unit, qty=lq.qty,
                                             reserved_cases=lq.reserved_cases, free_cases=lq.free_cases,
                                             unit_price=lq.unit_price, gross=lq.gross, discount=lq.discount,
                                             gst=lq.gst, total=lq.total, scheme_note="; ".join(lq.notes) or None))
            db.add(order)
            if source == "ai_capture" and day <= 30:
                _past_capture(db, rng, order, quote, sku_by_code, created)
            day += rng.randint(6, 12)
    db.flush()

    for index, text, minutes_ago in MESSAGES:
        db.add(InboundMessage(retailer_id=retailers[index].id, text=text, received_at=utcnow() - timedelta(minutes=minutes_ago)))
    for index, kind, name, media_type, minutes_ago in MEDIA_MESSAGES:
        db.add(InboundMessage(retailer_id=retailers[index].id, text="", kind=kind, media_type=media_type,
                              media=(MEDIA / name).read_bytes(), received_at=utcnow() - timedelta(minutes=minutes_ago)))
    db.commit()


def _past_capture(db: Session, rng: random.Random, order: Order, quote, sku_by_code: dict, created) -> None:
    """History for the accuracy metric: an AI-read WhatsApp order the desk checked, with the odd correction."""
    db.flush()
    words = ", ".join(f"{l.qty} peti {sku_by_code[l.code].name.lower()}" for l in quote.lines)
    message = InboundMessage(retailer_id=order.retailer_id, text=words, status="ORDERED", order_id=order.id,
                             received_at=created - timedelta(minutes=rng.randint(4, 15)))
    db.add(message)
    db.flush()
    capture = Capture(message_id=message.id, retailer_id=order.retailer_id, engine="groq:openai/gpt-oss-120b",
                      status="CONFIRMED", warnings=[], created_at=created - timedelta(minutes=rng.randint(2, 4)),
                      confirmed_at=created)
    for position, l in enumerate(quote.lines):
        sku = sku_by_code[l.code]
        capture.lines.append(CaptureLine(
            position=position, raw_text=f"{l.qty} peti {sku.name.lower()}", phrase=sku.line.lower(), qty=l.qty, unit="CASE",
            suggested_sku_id=sku.id, confidence=0.9, level="HIGH", alternatives=[], reasons=["Sample history"],
            final_sku_id=sku.id, final_qty=l.qty, final_unit="CASE", corrected=rng.random() < 0.05))
    db.add(capture)


def reset() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)


if __name__ == "__main__":
    if "--reset" in sys.argv:
        reset()
        print("Database rebuilt with sample data.")
