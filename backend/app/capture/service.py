"""AI order capture: read a message, cross-check the reading, match SKUs, and turn a confirmed draft into an order."""
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..db import utcnow
from ..models import Alias, Capture, CaptureLine, InboundMessage, Order, OrderLine, Sku, User
from ..orders import audit, place_order
from .llm import read_order
from .matcher import Candidate, build_candidate, match_line
from .text import CASE_WORDS, PIECE_WORDS, _size, basic_clean, canonical, parse_message, parse_segment, unit_from_words, words


def catalogue(db: Session) -> tuple[list[Candidate], dict[int, Sku]]:
    skus = list(db.scalars(select(Sku)))
    return [build_candidate(s.id, s.code, s.name, s.line, s.size_value, s.keywords) for s in skus], {s.id: s for s in skus}


def history(db: Session, retailer_id: int) -> set[int]:
    since = utcnow() - timedelta(days=90)
    return set(db.scalars(select(OrderLine.sku_id).join(Order).where(
        Order.retailer_id == retailer_id, Order.created_at >= since, Order.status != "CANCELLED")))


def aliases(db: Session, retailer_id: int) -> dict[str, int]:
    return {a.phrase: a.sku_id for a in db.scalars(select(Alias).where(Alias.retailer_id == retailer_id))}


def content_words(text: str) -> set[str]:
    return {w for w in words(text) if not w.isdigit() and w not in CASE_WORDS | PIECE_WORDS}


def _read(text: str) -> tuple[list[dict], str, list[str]]:
    """Lines as {raw_text, phrase, query, qty, unit, size_value, size_label, reasons, cap}."""
    rule_lines = parse_message(text)
    model_lines, engine = read_order(text)
    if model_lines is None:
        configured = bool(settings.groq_api_key or settings.gemini_api_key)
        warning = ("The AI reader did not respond, so simple rules read this message. Check every line."
                   if configured else "No AI key is configured, so simple rules read this message. Check every line.")
        return [{"raw_text": p.raw_text, "phrase": p.phrase, "query": p.phrase, "qty": p.qty, "unit": p.unit,
                 "size_value": p.size_value, "size_label": p.size_label, "reasons": [], "cap": None}
                for p in rule_lines], "rules", [warning]

    message_words = words(text)
    lines, warnings, used = [], [], set()
    for m in model_lines:
        reasons, cap = [], None
        quoted = words(m["raw_text"])
        if not quoted <= message_words:
            reasons.append("The AI quoted words that are not in the message")
            cap = "LOW"
        # Cross-check against the rule reading of the same part of the message, i.e. the shop's full words.
        overlap, index = max(((len(content_words(m["raw_text"]) & content_words(r.raw_text)), i)
                              for i, r in enumerate(rule_lines)), default=(0, None))
        check = rule_lines[index] if overlap else parse_segment(m["raw_text"])
        if overlap:
            used.add(index)
        shop_words = check.raw_text if check else m["raw_text"]
        unit = unit_from_words(shop_words)  # the unit must be in the shop's words, never the model's guess
        if m["unit"] and unit is None:
            reasons.append("Unit is not written in the message; ask the shop")
        qty = m["qty"]
        if check and check.qty and qty and check.qty != qty:
            reasons.append(f"AI read {qty} but the words say {check.qty}; check the quantity")
            qty, cap = check.qty, cap or "MEDIUM"
        qty = qty or (check.qty if check else None)
        size_value, size_label = (check.size_value, check.size_label) if check else (None, None)
        if size_value is None and m["size"]:
            size_value, size_label, _ = _size(basic_clean(m["size"]))
        phrase = check.phrase if check else canonical(m["item"])
        lines.append({"raw_text": shop_words, "phrase": phrase, "query": f"{phrase} {canonical(m['item'])}",
                      "qty": qty, "unit": unit, "size_value": size_value, "size_label": size_label,
                      "reasons": reasons, "cap": cap})
    # Anything the rules found that no model line covers is shown too, so a skipped item can't vanish.
    for i, p in enumerate(rule_lines):
        if i not in used:
            lines.append({"raw_text": p.raw_text, "phrase": p.phrase, "query": p.phrase, "qty": p.qty, "unit": p.unit,
                          "size_value": p.size_value, "size_label": p.size_label, "cap": "LOW",
                          "reasons": ["The AI skipped this part of the message; read by simple rules"]})
            warnings.append(f"The AI skipped “{p.raw_text}”. It is added below for you to check.")
    return lines, engine, warnings


LEVELS = ["LOW", "MEDIUM", "HIGH"]


def run_capture(db: Session, message: InboundMessage, user: User) -> Capture:
    candidates, skus = catalogue(db)
    past, learned = history(db, message.retailer_id), aliases(db, message.retailer_id)
    lines, engine, warnings = _read(message.text)
    if not lines:
        warnings.append("No product lines were found in this message.")
    capture = Capture(message_id=message.id, retailer_id=message.retailer_id, engine=engine, warnings=warnings)
    for position, line in enumerate(lines):
        match = match_line(line["phrase"], line["size_value"], candidates, past, learned, query=line["query"])
        level = match.level
        if line["cap"] and LEVELS.index(level) > LEVELS.index(line["cap"]):
            level = line["cap"]
        reasons = line["reasons"] + match.reasons
        if line["unit"] is None:
            reasons.insert(0, "Case or piece? The message doesn't say")
        if match.sku_id and skus[match.sku_id].stock_cases <= 0:
            reasons.insert(0, f"{skus[match.sku_id].name} is out of stock")
        capture.lines.append(CaptureLine(
            position=position, raw_text=line["raw_text"], phrase=line["phrase"], qty=line["qty"], unit=line["unit"],
            size_hint=line["size_label"], suggested_sku_id=match.sku_id, confidence=match.confidence, level=level,
            alternatives=match.alternatives, reasons=reasons))
    message.status = "CAPTURED"
    db.add(capture)
    db.flush()
    audit(db, user, "capture.created", f"message {message.id} -> capture {capture.id} ({engine})")
    db.commit()
    return capture


def load_capture(db: Session, capture_id: int) -> Capture | None:
    return db.scalar(select(Capture).where(Capture.id == capture_id).options(
        selectinload(Capture.lines), selectinload(Capture.message).selectinload(InboundMessage.retailer)))


def confirm_capture(db: Session, capture: Capture, decisions: list, user: User) -> tuple[Order, list[str]]:
    if capture.status != "DRAFT":
        raise HTTPException(409, "This draft was already turned into an order")
    by_id = {line.id: line for line in capture.lines}
    order_lines, learned = [], []
    for d in decisions:
        line = by_id.get(d.line_id)
        if not line:
            raise HTTPException(404, f"Line {d.line_id} is not part of this draft")
        if d.removed:
            continue
        if not d.sku_id or not d.qty or not d.unit:
            missing = "product" if not d.sku_id else "quantity" if not d.qty else "case or piece"
            raise HTTPException(422, f"“{line.raw_text}” still needs a {missing}")
        order_lines.append((d.sku_id, d.qty, d.unit))
        if d.sku_id != line.suggested_sku_id and line.phrase:
            alias = db.scalar(select(Alias).where(Alias.retailer_id == capture.retailer_id, Alias.phrase == line.phrase))
            if alias:
                alias.sku_id = d.sku_id
            else:
                db.add(Alias(retailer_id=capture.retailer_id, phrase=line.phrase, sku_id=d.sku_id))
            learned.append(line.phrase)
    if not order_lines:
        raise HTTPException(422, "Keep at least one line to place an order")
    capture.status = "CONFIRMED"
    capture.message.status = "ORDERED"
    order = place_order(db, capture.message.retailer, order_lines, "ai_capture", user, note=f"From WhatsApp message #{capture.message_id}")
    capture.message.order_id = order.id
    db.commit()
    return order, learned
