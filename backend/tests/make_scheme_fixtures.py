"""Writes tests/fixtures/scheme_cases.json from the Python engine. The TypeScript engine (salesman offline mode)
is tested against the same file, so the two can't drift apart. Re-run only when the rules change on purpose."""
import json
from datetime import date
from decimal import Decimal
from pathlib import Path

from app.pricing import Item, SchemeRule, quote_line

TODAY = date(2026, 11, 7)
FREE = {"kind": "FREE_GOODS", "label": "Buy 10 cases get 1 free", "buy_qty": 10, "free_qty": 1}
SLAB3 = {"kind": "SLAB_DISCOUNT", "label": "3% off 5 or more cases", "min_cases": 5, "discount_pct": 3}
SLABS = [{"kind": "SLAB_DISCOUNT", "label": "2% off 3+", "min_cases": 3, "discount_pct": 2},
         {"kind": "SLAB_DISCOUNT", "label": "4% off 6+", "min_cases": 6, "discount_pct": 4}]
BISCUIT = {"code": "SKU-BS-075", "units_per_case": 96, "unit_price": 8.10, "gst_rate": 18, "stock_cases": 340, "schemes": [FREE]}
DETERGENT = {"code": "SKU-DT-1KG", "units_per_case": 20, "unit_price": 101.50, "gst_rate": 18, "stock_cases": 85, "schemes": [SLAB3]}
TEA = {"code": "SKU-TE-1KG", "units_per_case": 12, "unit_price": 440, "gst_rate": 5, "stock_cases": 22, "schemes": SLABS}
CASES = [
    ("9 cases: one short of a free case", BISCUIT, 9, "CASE"), ("10 cases earn 1 free", BISCUIT, 10, "CASE"),
    ("21 cases earn 2 free", BISCUIT, 21, "CASE"), ("free case capped by stock", {**BISCUIT, "stock_cases": 10}, 10, "CASE"),
    ("1000 pieces: 10 full cases, 11 reserved", BISCUIT, 1000, "PIECE"), ("4 cases: slab hint", DETERGENT, 4, "CASE"),
    ("5 cases: 3% slab and GST", DETERGENT, 5, "CASE"), ("out of stock", {**DETERGENT, "stock_cases": 0}, 1, "CASE"),
    ("more than stock", DETERGENT, 86, "CASE"), ("best of two slabs", TEA, 6, "CASE"), ("lower slab only", TEA, 3, "CASE"),
    ("expired scheme ignored", {**BISCUIT, "schemes": [{**FREE, "valid_to": "2026-11-06"}]}, 10, "CASE"),
    ("paused scheme ignored", {**BISCUIT, "schemes": [{**FREE, "active": False}]}, 10, "CASE"),
    ("special price per shop", {**BISCUIT, "unit_price": 8.00}, 7, "CASE"),
]


def item(spec: dict) -> Item:
    rules = tuple(SchemeRule(kind=s["kind"], label=s["label"], buy_qty=s.get("buy_qty"), free_qty=s.get("free_qty"),
                             min_cases=s.get("min_cases"),
                             discount_pct=Decimal(str(s["discount_pct"])) if s.get("discount_pct") is not None else None,
                             valid_from=date.fromisoformat(s["valid_from"]) if s.get("valid_from") else None,
                             valid_to=date.fromisoformat(s["valid_to"]) if s.get("valid_to") else None,
                             active=s.get("active", True)) for s in spec["schemes"])
    return Item(spec["code"], spec["units_per_case"], Decimal(str(spec["unit_price"])), Decimal(str(spec["gst_rate"])),
                spec["stock_cases"], rules)


def expected(spec: dict, qty: int, unit: str) -> dict:
    q = quote_line(item(spec), qty, unit, TODAY)
    return {"pieces": q.pieces, "full_cases": q.full_cases, "reserved_cases": q.reserved_cases, "free_cases": q.free_cases,
            "free_earned": q.free_earned, "gross": float(q.gross), "discount": float(q.discount), "gst": float(q.gst),
            "total": float(q.total), "errors": q.errors, "hint_data": q.hint_data}


if __name__ == "__main__":
    out = [{"name": n, "today": TODAY.isoformat(), "item": spec, "qty": qty, "unit": unit, "expect": expected(spec, qty, unit)}
           for n, spec, qty, unit in CASES]
    Path(__file__).with_name("fixtures").joinpath("scheme_cases.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"wrote {len(out)} cases")
