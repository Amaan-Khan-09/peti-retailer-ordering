"""Normalising Hindi / Hinglish / English order text, and a rule-based line parser.

The parser is the fallback when no AI model is reachable, and the cross-check on what the model returns:
units and quantities must come from the retailer's own words, never from a guess.
"""
import re
from dataclasses import dataclass

# Devanagari words seen in order messages, mapped to the romanised form the rest of the code uses.
DEVANAGARI = {
    "पेटी": "peti", "पेटि": "peti", "बिस्कुट": "biscuit", "चाय पत्ती": "chai patti", "चायपत्ती": "chai patti",
    "चाय": "chai", "छोटा": "chhota", "छोटी": "chhoti", "बड़ा": "bada", "बड़ी": "badi", "किलो": "kilo",
    "वाला": "wala", "वाली": "wali", "और": "aur", "साबुन": "sabun", "पैकेट": "packet", "नग": "nag",
    "सर्फ": "surf", "डिटर्जेंट": "detergent", "मैरी": "marie", "क्रीम": "cream", "ग्लूकोज": "glucose",
    "भैया": "bhaiya", "भेज दो": "bhej do", "भेजो": "bhejo", "चाहिए": "chahiye", "ग्राम": "gram",
    # spellings and words seen in Whisper transcripts of Hindi voice notes
    "बिसकुट": "biscuit", "बिस्किट": "biscuit", "भाईया": "bhaiya", "भईया": "bhaiya", "भेज देना": "bhej dena",
    "डब्बा": "dabba", "डब्बे": "dabba", "डिब्बा": "dabba", "डिब्बे": "dabba", "पेटियां": "peti", "पेटियाँ": "peti",
    "केस": "case", "पीस": "piece", "लिक्विड": "liquid", "बर्तन": "bartan", "शैम्पू": "shampoo", "टूथपेस्ट": "toothpaste",
    "नमकीन": "namkeen", "फिनाइल": "phenyl", "पाउडर": "powder", "वाशिंग पाउडर": "washing powder",
    "एक": "ek", "दो": "do", "तीन": "teen", "चार": "char", "पाँच": "paanch", "पांच": "paanch", "छह": "chhe",
    "सात": "saat", "आठ": "aath", "नौ": "nau", "दस": "das", "बीस": "bees",
}
_DEVANAGARI_RE = re.compile(
    r"(?<![ऀ-ॿ])(" + "|".join(sorted(map(re.escape, DEVANAGARI), key=len, reverse=True)) + r")(?![ऀ-ॿ])")
DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

# Multi-word phrases first; each maps to catalogue vocabulary.
SYNONYMS = [
    ("washing powder", "detergent powder"), ("kapde ka powder", "detergent powder"), ("chai patti", "tea leaf"),
    ("chaipatti", "tea leaf"), ("bartan liquid", "dishwash liquid"), ("bartan", "dishwash"),
    ("floor cleaner", "floor cleaner"), ("tooth paste", "toothpaste"),
    ("surf", "detergent powder"), ("sarf", "detergent powder"), ("sabun", "soap"), ("biskut", "biscuit"),
    ("biscut", "biscuit"), ("biscuits", "biscuit"), ("chai", "tea"), ("patti", "leaf"), ("chhota", "small"),
    ("chota", "small"), ("chhoti", "small"), ("choti", "small"), ("bada", "large"), ("badi", "large"),
    ("big", "large"), ("phenyl", "floor cleaner"), ("pocha", "floor cleaner"), ("manjan", "toothpaste"),
    ("namkeen", "snack cracker"), ("mathri", "snack cracker"), ("crackers", "cracker"), ("shampu", "shampoo"),
]
GREETINGS = ["bhaiya", "bhaiyya", "bhai", "namaste", "namaskar", "hello", "hi", "sir", "ji", "please", "pls", "plz",
             "bhej do", "bhej dena", "bhejo", "dedo", "de do", "chahiye", "send", "kal tak", "aaj", "jaldi", "thanks",
             "dhanyavaad", "order", "mera", "mujhe", "hamko", "humko", "ka", "ki", "ke"]
NUMBER_WORDS = {"ek": 1, "do": 2, "teen": 3, "char": 4, "chaar": 4, "paanch": 5, "panch": 5, "chhe": 6, "chhah": 6,
                "saat": 7, "aath": 8, "nau": 9, "das": 10, "gyarah": 11, "barah": 12, "pandrah": 15, "bees": 20,
                "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "ten": 10, "twelve": 12}
CASE_WORDS = {"peti", "petti", "pety", "case", "cases", "carton", "cartons", "ctn", "ctns", "cs"}
PIECE_WORDS = {"piece", "pieces", "pc", "pcs", "packet", "packets", "pkt", "pkts", "nag", "pouch", "pouches"}
# Containers that don't say case or piece: the quantity is read, the unit is left for the desk to ask.
UNCLEAR_UNITS = {"dabba", "dibba", "dabbe", "box", "boxes", "bag", "bori"}
FILLER = {"wala", "wali", "wale", "vala", "waala"}
UNIT_PATTERN = "|".join(sorted(CASE_WORDS | PIECE_WORDS, key=len, reverse=True))
COUNTED_PATTERN = "|".join(sorted(CASE_WORDS | PIECE_WORDS | UNCLEAR_UNITS, key=len, reverse=True))
SIZE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(kg|kilo|kgs|g|gm|gms|gram|grams|ml|l|ltr|litre|liter)\b")
WALA_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(wala|wali|vala|waala)\b")
QTY_UNIT_RE = re.compile(rf"(\d+)\s*({UNIT_PATTERN})\b")
SPLIT_RE = re.compile(r"\n|,|;|\+|\band\b|\baur\b|और|\bor\b(?=\s+\d)", re.IGNORECASE)


def basic_clean(text: str) -> str:
    text = text.translate(DEVANAGARI_DIGITS)
    text = _DEVANAGARI_RE.sub(lambda m: f" {DEVANAGARI[m.group(1)]} ", text)  # whole words only: "दो" but not "दोनों"
    text = text.lower()
    text = re.sub(r"(\d)([a-z])", r"\1 \2", text)  # "5peti" -> "5 peti", "1kg" -> "1 kg"
    return re.sub(r"[^\w\s.,;+]", " ", text)


def canonical(text: str) -> str:
    """Words mapped to catalogue vocabulary, greetings and filler removed."""
    text = f" {basic_clean(text)} "
    for phrase in sorted(GREETINGS, key=len, reverse=True):
        text = re.sub(rf"\s{re.escape(phrase)}(?=\s)", " ", text)
    for src, dst in SYNONYMS:
        text = re.sub(rf"\b{re.escape(src)}\b", dst, text)
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class ParsedLine:
    raw_text: str
    phrase: str  # item words only, canonical; the alias key
    qty: int | None
    unit: str | None  # CASE | PIECE | None (ask the desk)
    size_value: float | None  # grams or ml, or a bare "250 wala" number
    size_label: str | None


def words(text: str) -> set[str]:
    """Bare words, punctuation dropped, so 'chhota,' and 'chhota' compare equal."""
    return set(re.findall(r"\w+", basic_clean(text)))


def unit_from_words(text: str) -> str | None:
    found = words(text)
    has_case, has_piece = bool(found & CASE_WORDS), bool(found & PIECE_WORDS)
    if has_case == has_piece:
        return None  # neither, or both: ask
    return "CASE" if has_case else "PIECE"


def _size(text: str) -> tuple[float | None, str | None, str]:
    match = SIZE_RE.search(text)
    if match:
        value, unit = float(match.group(1)), match.group(2)
        grams = value * 1000 if unit in ("kg", "kilo", "kgs", "l", "ltr", "litre", "liter") else value
        label = f"{match.group(1)} {'kg' if unit in ('kg', 'kilo', 'kgs') else unit}"
        return grams, label, text[:match.start()] + " " + text[match.end():]
    match = WALA_RE.search(text)
    if match:
        return float(match.group(1)), f"{match.group(1)} wala", text[:match.start()] + " " + text[match.end():]
    return None, None, text


def parse_segment(segment: str) -> ParsedLine | None:
    text = f" {canonical(segment)} "
    if not text.strip():
        return None
    # number words become digits only right before a unit word or at the start ("do" also means "give")
    for word, number in NUMBER_WORDS.items():
        text = re.sub(rf"(^\s|\s){word}\s+(?=({COUNTED_PATTERN})\b)", f" {number} ", text)
        text = re.sub(rf"^\s{word}\s", f" {number} ", text)
    size_value, size_label, text = _size(text)
    qty, unit = None, None
    match = QTY_UNIT_RE.search(text)
    if match:
        qty = int(match.group(1))
        unit = "CASE" if match.group(2) in CASE_WORDS else "PIECE"
        text = text[:match.start()] + " " + text[match.end():]
    else:
        number = re.search(r"\b(\d+)\b", text)
        if number:
            qty = int(number.group(1))
            text = text[:number.start()] + " " + text[number.end():]
    words = [w for w in re.findall(r"\w+", text)
             if not w.isdigit() and w not in CASE_WORDS | PIECE_WORDS | UNCLEAR_UNITS | FILLER]
    phrase = " ".join(words)
    if not phrase:
        return None
    return ParsedLine(raw_text=segment.strip(" ,.;"), phrase=phrase, qty=qty, unit=unit,
                      size_value=size_value, size_label=size_label)


def parse_message(text: str) -> list[ParsedLine]:
    """Splits on commas, new lines and 'aur'/'and', keeping each segment in the shop's original words."""
    segments = [s for s in SPLIT_RE.split(text) if s and s.strip()]
    return [line for line in (parse_segment(s) for s in segments) if line]
