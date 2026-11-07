"""Scheme engine: prices a cart line with free-goods and slab-discount schemes.

Pure functions over small dataclasses, so the rules can be tested without a database.
Assumptions (labelled in the TDD):
- Dealer prices are per piece and exclude GST; GST is added on the discounted value.
- Schemes count full cases only. A piece order of 150 biscuits counts as 1 full case.
- Free goods carry no price and no GST, and need stock like any other case.
- When several slabs qualify, the best one applies; slabs and free goods can both apply.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from math import ceil

CASE, PIECE = "CASE", "PIECE"
CENT = Decimal("0.01")


def money(value: Decimal | int | float) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class SchemeRule:
    kind: str  # FREE_GOODS | SLAB_DISCOUNT
    label: str
    buy_qty: int | None = None
    free_qty: int | None = None
    min_cases: int | None = None
    discount_pct: Decimal | None = None
    valid_from: date | None = None
    valid_to: date | None = None
    active: bool = True

    def applies_on(self, day: date) -> bool:
        if not self.active:
            return False
        return (self.valid_from is None or self.valid_from <= day) and (self.valid_to is None or day <= self.valid_to)


@dataclass(frozen=True)
class Item:
    code: str
    units_per_case: int
    unit_price: Decimal
    gst_rate: Decimal
    stock_cases: int
    schemes: tuple[SchemeRule, ...] = ()


@dataclass
class LineQuote:
    code: str
    unit: str
    qty: int
    pieces: int
    full_cases: int
    reserved_cases: int
    free_cases: int
    unit_price: Decimal
    gross: Decimal
    discount: Decimal
    gst: Decimal
    total: Decimal
    notes: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    hint: str | None = None


@dataclass
class OrderQuote:
    lines: list[LineQuote]
    subtotal: Decimal
    discount_total: Decimal
    gst_total: Decimal
    total: Decimal
    free_cases_total: int

    @property
    def errors(self) -> list[str]:
        return [f"{line.code}: {error}" for line in self.lines for error in line.errors]


def _best_slab(rules: list[SchemeRule], full_cases: int) -> SchemeRule | None:
    qualifying = [r for r in rules if r.kind == "SLAB_DISCOUNT" and r.min_cases and full_cases >= r.min_cases]
    return max(qualifying, key=lambda r: r.discount_pct or 0, default=None)


def _free_cases(rules: list[SchemeRule], full_cases: int) -> tuple[int, SchemeRule | None]:
    best, best_rule = 0, None
    for rule in rules:
        if rule.kind == "FREE_GOODS" and rule.buy_qty and rule.free_qty:
            free = (full_cases // rule.buy_qty) * rule.free_qty
            if free > best:
                best, best_rule = free, rule
    return best, best_rule


def _hint(rules: list[SchemeRule], full_cases: int, current_pct: Decimal) -> str | None:
    """The cheapest next step to a better deal, e.g. 'Add 1 more case to get 1 free'."""
    options = []
    for rule in rules:
        if rule.kind == "FREE_GOODS" and rule.buy_qty and rule.free_qty:
            need = rule.buy_qty - (full_cases % rule.buy_qty)
            options.append((need, f"Add {need} more case{'s' if need > 1 else ''} to get {rule.free_qty} free"))
        elif rule.kind == "SLAB_DISCOUNT" and rule.min_cases and (rule.discount_pct or 0) > current_pct and full_cases < rule.min_cases:
            need = rule.min_cases - full_cases
            options.append((need, f"Add {need} more case{'s' if need > 1 else ''} for {rule.discount_pct.normalize()}% off"))
    options = [o for o in options if o[0] <= 5]
    return min(options)[1] if options else None


def quote_line(item: Item, qty: int, unit: str, today: date) -> LineQuote:
    errors: list[str] = []
    if unit not in (CASE, PIECE):
        errors.append("Choose case or piece")
    if qty <= 0:
        errors.append("Quantity must be at least 1")
    qty = max(qty, 0)
    pieces = qty * item.units_per_case if unit == CASE else qty
    full_cases = pieces // item.units_per_case
    reserved_cases = ceil(pieces / item.units_per_case) if pieces else 0

    if item.stock_cases <= 0:
        errors.append("Out of stock")
    elif reserved_cases > item.stock_cases:
        errors.append(f"Only {item.stock_cases} cases in stock")

    rules = [r for r in item.schemes if r.applies_on(today)]
    gross = money(Decimal(pieces) * item.unit_price)
    slab = _best_slab(rules, full_cases)
    pct = slab.discount_pct if slab else Decimal("0")
    discount = money(gross * pct / 100)
    notes = [f"{slab.label}: {pct.normalize()}% off"] if slab else []

    free, free_rule = _free_cases(rules, full_cases)
    if free:
        spare = max(item.stock_cases - reserved_cases, 0)
        if free > spare:
            notes.append(f"{free_rule.label}: {free} free earned, only {spare} in stock")
            free = spare
        else:
            notes.append(f"{free_rule.label}: {free} free")

    taxable = gross - discount
    gst = money(taxable * item.gst_rate / 100)
    return LineQuote(
        code=item.code, unit=unit, qty=qty, pieces=pieces, full_cases=full_cases, reserved_cases=reserved_cases,
        free_cases=free, unit_price=item.unit_price, gross=gross, discount=discount, gst=gst, total=taxable + gst,
        notes=notes, errors=errors, hint=None if errors else _hint(rules, full_cases, pct),
    )


def quote_order(lines: list[tuple[Item, int, str]], today: date) -> OrderQuote:
    quoted = [quote_line(item, qty, unit, today) for item, qty, unit in lines]
    # The same SKU twice would double-count stock; merge it in the caller, flag it here.
    seen: set[str] = set()
    for line in quoted:
        if line.code in seen:
            line.errors.append("Listed twice; merge the lines")
        seen.add(line.code)
    return OrderQuote(
        lines=quoted,
        subtotal=sum((l.gross for l in quoted), Decimal("0")),
        discount_total=sum((l.discount for l in quoted), Decimal("0")),
        gst_total=sum((l.gst for l in quoted), Decimal("0")),
        total=sum((l.total for l in quoted), Decimal("0")),
        free_cases_total=sum(l.free_cases for l in quoted),
    )
