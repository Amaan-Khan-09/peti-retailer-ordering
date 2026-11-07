from datetime import date, timedelta
from decimal import Decimal

from app.pricing import CASE, PIECE, Item, SchemeRule, quote_line, quote_order

TODAY = date(2026, 11, 7)
BUY_10_GET_1 = SchemeRule("FREE_GOODS", "Buy 10 cases get 1 free", buy_qty=10, free_qty=1)
THREE_PCT_5 = SchemeRule("SLAB_DISCOUNT", "3% off 5 or more cases", min_cases=5, discount_pct=Decimal("3"))


def biscuit(stock=340, schemes=(BUY_10_GET_1,)):
    return Item("SKU-BS-075", 96, Decimal("8.10"), Decimal("18"), stock, schemes)


def detergent(stock=85):
    return Item("SKU-DT-1KG", 20, Decimal("101.50"), Decimal("18"), stock, (THREE_PCT_5,))


def test_free_goods_need_full_multiples():
    assert quote_line(biscuit(), 9, CASE, TODAY).free_cases == 0
    assert quote_line(biscuit(), 10, CASE, TODAY).free_cases == 1
    assert quote_line(biscuit(), 21, CASE, TODAY).free_cases == 2


def test_hint_shows_the_next_case_that_earns_a_free_one():
    assert quote_line(biscuit(), 9, CASE, TODAY).hint == "Add 1 more case to get 1 free"
    assert quote_line(detergent(), 4, CASE, TODAY).hint == "Add 1 more case for 3% off"


def test_free_goods_are_capped_by_stock_and_say_so():
    line = quote_line(biscuit(stock=10), 10, CASE, TODAY)
    assert line.errors == [] and line.free_cases == 0
    assert "only 0 in stock" in line.notes[0]


def test_slab_discount_and_gst_on_discounted_value():
    line = quote_line(detergent(), 5, CASE, TODAY)
    assert line.gross == Decimal("10150.00")
    assert line.discount == Decimal("304.50")
    assert line.gst == Decimal("1772.19")  # 18% of 9845.50
    assert line.total == Decimal("11617.69")


def test_best_slab_wins_when_several_qualify():
    tea = Item("SKU-TE-1KG", 12, Decimal("440"), Decimal("5"), 22, (
        SchemeRule("SLAB_DISCOUNT", "2% off 3+", min_cases=3, discount_pct=Decimal("2")),
        SchemeRule("SLAB_DISCOUNT", "4% off 6+", min_cases=6, discount_pct=Decimal("4"))))
    assert quote_line(tea, 6, CASE, TODAY).discount == Decimal("1267.20")  # 4% of 31680


def test_pieces_count_only_full_cases_for_schemes_but_reserve_part_cases():
    line = quote_line(biscuit(), 1000, PIECE, TODAY)  # 10.4 cases
    assert (line.full_cases, line.reserved_cases, line.free_cases) == (10, 11, 1)
    assert line.gross == Decimal("8100.00")


def test_stock_limits_are_errors_not_silent_cuts():
    assert quote_line(detergent(stock=0), 1, CASE, TODAY).errors == ["Out of stock"]
    assert quote_line(detergent(stock=85), 86, CASE, TODAY).errors == ["Only 85 cases in stock"]


def test_expired_or_inactive_schemes_do_not_apply():
    expired = SchemeRule("FREE_GOODS", "old", buy_qty=10, free_qty=1, valid_to=TODAY - timedelta(days=1))
    paused = SchemeRule("FREE_GOODS", "paused", buy_qty=10, free_qty=1, active=False)
    assert quote_line(biscuit(schemes=(expired, paused)), 10, CASE, TODAY).free_cases == 0


def test_same_sku_twice_is_flagged_and_totals_add_up():
    quote = quote_order([(biscuit(), 2, CASE), (biscuit(), 1, CASE), (detergent(), 5, CASE)], TODAY)
    assert quote.errors == ["SKU-BS-075: Listed twice; merge the lines"]
    assert quote.total == sum(l.total for l in quote.lines)
