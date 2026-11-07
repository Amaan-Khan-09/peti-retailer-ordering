from app.capture import service
from app.capture.matcher import build_candidate, match_line
from app.capture.text import parse_message
from app.seed import SKUS

SAMPLE = "bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti"
CANDIDATES = [build_candidate(i, code, name, line, size, keywords)
              for i, (code, name, _, _, line, _, size, _, _, _, _, keywords) in enumerate(SKUS, start=1)]
ID = {c.code: c.sku_id for c in CANDIDATES}


def match(phrase, size=None, history=(), aliases=None):
    return match_line(phrase, size, CANDIDATES, set(history), aliases or {})


def test_sample_message_from_the_brief_is_split_and_read():
    lines = parse_message(SAMPLE)
    assert [(l.qty, l.unit, l.size_value) for l in lines] == [(5, "CASE", None), (2, "CASE", 1000), (1, "CASE", 250)]
    assert lines[0].raw_text == "bhaiya 5 peti biscuit chhota"  # the shop's own words, kept for the desk


def test_sample_lines_map_to_the_right_skus():
    lines = parse_message(SAMPLE)
    assert match(lines[0].phrase, history=[ID["SKU-BS-075"]]).sku_id == ID["SKU-BS-075"]
    assert match(lines[1].phrase, lines[1].size_value).sku_id == ID["SKU-DT-1KG"]
    tea = match(lines[2].phrase, lines[2].size_value)
    assert tea.sku_id == ID["SKU-TE-250"] and ID["SKU-TE-500"] in tea.alternatives


def test_unclear_units_are_left_empty_to_ask():
    (line,) = parse_message("3 dabba bartan liquid")
    assert (line.qty, line.unit) == (3, None)


def test_devanagari_and_number_words():
    lines = parse_message("5 पेटी बिस्कुट छोटा और 2 पेटी चाय पत्ती 500 वाला")
    assert [(l.qty, l.unit, l.size_value) for l in lines] == [(5, "CASE", None), (2, "CASE", 500)]
    assert parse_message("paanch peti marie biscuit")[0].qty == 5
    assert parse_message("marie biscuit 3 peti de do")[0].qty == 3  # "do" here means "give", not 2


def test_past_orders_break_ties_but_never_beat_the_shops_words():
    assert match("detergent bar", history=[ID["SKU-DT-1KG"]]).sku_id == ID["SKU-DB-200"]
    plain = match("biscuit")
    assert plain.level != "HIGH" and len(plain.alternatives) == 2


def test_alias_from_a_desk_correction_wins():
    result = match("tea leaf", 250, aliases={"tea leaf": ID["SKU-TE-500"]})
    assert result.sku_id == ID["SKU-TE-500"] and result.level == "HIGH"


def test_unknown_item_gets_no_guess():
    result = match("mobile recharge")
    assert result.sku_id is None and result.level == "LOW"


def _read_with_model(monkeypatch, model_lines):
    monkeypatch.setattr(service, "read_order", lambda text: (model_lines, "test-model"))


def test_model_cannot_invent_a_unit(monkeypatch):
    _read_with_model(monkeypatch, [{"raw_text": "3 dabba bartan liquid", "item": "dishwash liquid", "qty": 3,
                                    "unit": "case", "size": None}])
    (line,), engine, _ = service._read("3 dabba bartan liquid")
    assert engine == "test-model" and line["unit"] is None
    assert "Unit is not written in the message; ask the shop" in line["reasons"]


def test_model_quantity_is_checked_against_the_words(monkeypatch):
    _read_with_model(monkeypatch, [{"raw_text": "5 peti biscuit chhota", "item": "small biscuit", "qty": 50,
                                    "unit": "case", "size": None}])
    (line,), _, _ = service._read("5 peti biscuit chhota")
    assert line["qty"] == 5 and line["cap"] == "MEDIUM"


def test_words_the_model_made_up_are_flagged(monkeypatch):
    _read_with_model(monkeypatch, [{"raw_text": "10 peti premium cookies", "item": "biscuit", "qty": 10,
                                    "unit": "case", "size": None}])
    lines, _, _ = service._read("5 peti biscuit chhota")
    assert lines[0]["cap"] == "LOW" and "not in the message" in lines[0]["reasons"][0]
    assert lines[1]["raw_text"] == "5 peti biscuit chhota"  # the real line still reaches the desk


def test_skipped_lines_are_warned_about(monkeypatch):
    _read_with_model(monkeypatch, [{"raw_text": "5 peti biscuit chhota", "item": "small biscuit", "qty": 5,
                                    "unit": "case", "size": None}])
    _, _, warnings = service._read(SAMPLE)
    lines, _, warnings = service._read(SAMPLE)
    assert any("skipped" in w for w in warnings) and len(lines) == 3 and lines[1]["cap"] == "LOW"


def test_a_heading_the_model_rightly_skipped_is_not_added_back(monkeypatch):
    _read_with_model(monkeypatch, [{"raw_text": "glucose biscuit 200g - 4 peti", "item": "glucose biscuit", "qty": 4,
                                    "unit": "case", "size": "200 g"}])
    lines, _, warnings = service._read("Patel Provision - order, glucose biscuit 200g - 4 peti")
    assert len(lines) == 1 and not warnings


def test_rules_fill_in_what_the_model_lost(monkeypatch):
    _read_with_model(monkeypatch, [{"raw_text": "peti cream biscuit bada", "item": "large cream biscuit", "qty": None,
                                    "unit": "case", "size": None}])
    (line,), _, warnings = service._read("bhai do peti cream biscuit bada")
    assert (line["qty"], line["unit"]) == (2, "CASE") and not warnings


def test_no_model_falls_back_to_rules_and_says_so(monkeypatch):
    monkeypatch.setattr(service, "read_order", lambda text: (None, ""))
    lines, engine, warnings = service._read(SAMPLE)
    assert engine == "rules" and len(lines) == 3 and "simple rules" in warnings[0]
