"""Maps a parsed order line to catalogue SKUs with a confidence level and two alternatives.

Deterministic on purpose: the model only reads the message; which SKU a line means is decided here,
from the catalogue, the retailer's past orders and the desk's earlier corrections (aliases).
"""
from dataclasses import dataclass

from .text import canonical

NOUNS = {"biscuit", "detergent", "tea", "soap", "shampoo", "toothpaste", "dishwash", "floor", "cleaner", "snack",
         "cracker"}
HINT_WORDS = {"small", "large"}


@dataclass(frozen=True)
class Candidate:
    sku_id: int
    code: str
    name: str
    line: str
    size_value: float
    words: frozenset[str]


@dataclass
class Match:
    sku_id: int | None
    confidence: float
    level: str
    alternatives: list[int]
    reasons: list[str]


def build_candidate(sku_id: int, code: str, name: str, line: str, size_value: float, keywords: str) -> Candidate:
    return Candidate(sku_id, code, name, line, size_value, frozenset(canonical(f"{name} {keywords}").split()))


def _weight(word: str) -> float:
    return 3.0 if word in NOUNS else 1.0


def match_line(phrase: str, size_value: float | None, candidates: list[Candidate],
               history: set[int], aliases: dict[str, int], query: str | None = None) -> Match:
    """phrase is the alias key (the shop's own words); query may add the model's English reading."""
    match = _score(query or phrase, size_value, candidates, history)
    if phrase in aliases:
        sku_id = aliases[phrase]
        others = [s for s in [match.sku_id, *match.alternatives] if s and s != sku_id][:2]
        return Match(sku_id, 0.98, "HIGH", others, ["Learned from an earlier desk correction for this shop"])
    return match


def _score(phrase: str, size_value: float | None, candidates: list[Candidate], history: set[int]) -> Match:
    words = set(phrase.split())
    query = words - HINT_WORDS
    total = sum(_weight(w) for w in query) or 1.0
    smallest: dict[str, float] = {}
    largest: dict[str, float] = {}
    for c in candidates:
        smallest[c.line] = min(smallest.get(c.line, c.size_value), c.size_value)
        largest[c.line] = max(largest.get(c.line, c.size_value), c.size_value)

    text_scores = {c.sku_id: sum(_weight(w) for w in query & c.words) / total for c in candidates}
    best_text = max(text_scores.values(), default=0.0)
    scored = []
    for c in candidates:
        hit = query & c.words
        text_score = text_scores[c.sku_id]
        if text_score == 0:
            continue
        reasons = [f"Words matched: {', '.join(sorted(hit))}"]
        size_part = 0.0
        if size_value is not None:
            size_part = 1.0 if abs(c.size_value - size_value) < 0.01 else -0.5
            if size_part > 0:
                reasons.append(f"Pack size {c.size_value:g} matches")
        elif "small" in words and c.size_value == smallest[c.line]:
            size_part = 0.6
            reasons.append("'Small' read as the smallest pack of this line")
        elif "large" in words and c.size_value == largest[c.line]:
            size_part = 0.6
            reasons.append("'Large' read as the biggest pack of this line")
        # Past orders break ties between equally good word matches; they never beat a word the shop wrote.
        past = c.sku_id in history and text_score >= best_text
        if past:
            reasons.append("This shop has ordered it before")
        score = max(0.0, min(1.0, 0.6 * text_score + 0.2 * size_part + (0.2 if past else 0.0)))
        scored.append((score, c, reasons))

    scored.sort(key=lambda s: (s[0], s[1].sku_id in history), reverse=True)
    if not scored or scored[0][0] < 0.3:
        return Match(None, scored[0][0] if scored else 0.0, "LOW", [s[1].sku_id for s in scored[:3]],
                     ["No catalogue item matches these words well; pick one"])
    top, best, reasons = scored[0]
    margin = top - (scored[1][0] if len(scored) > 1 else 0.0)
    level = "HIGH" if top >= 0.75 and margin >= 0.15 else "MEDIUM" if top >= 0.5 else "LOW"
    if margin < 0.15 and len(scored) > 1:
        reasons.append(f"Close second: {scored[1][1].name}")
    return Match(best.sku_id, round(top, 2), level, [s[1].sku_id for s in scored[1:3]], reasons)
