"""Reads an order message with an LLM (Groq first, then Gemini). Returns None when no model is usable."""
import json
import logging

import httpx

from ..config import settings

log = logging.getLogger(__name__)
TIMEOUT = 20

SYSTEM = """You read orders that kirana shop owners send to an FMCG distributor on WhatsApp.
Messages mix Hindi (often in English letters), Devanagari and English.
Return JSON only: {"lines": [{"raw_text": "...", "item": "...", "qty": 5, "unit": "case", "size": "1 kg"}]}
Rules:
- One line per product. raw_text = the exact words from the message for that product, copied, not translated.
- item = a short English description using catalogue words: biscuit, glucose, cream, marie, detergent powder,
  detergent bar, dishwash liquid, floor cleaner, tea leaf, tea dust, soap, shampoo, toothpaste, snack cracker,
  plus "small" or "large" if the shopkeeper said chhota/bada.
- qty = the number of units ordered, or null if no number is given.
- unit = "case" only if they wrote peti/petti/case/carton; "piece" only if they wrote piece/packet/pkt/nag.
  Otherwise null. Never guess a unit. "dabba" and "box" are unclear: null.
- size = pack size if stated ("1 kilo" -> "1 kg", "250 wala" -> "250 g"), else null.
- Ignore greetings and filler (bhaiya, ji, bhej do). Do not invent products that are not in the message.
Glossary: peti = case, chhota = small, bada = large, chai patti = tea leaf, washing powder/surf = detergent powder,
sabun = soap, bartan = dishwash, phenyl = floor cleaner, namkeen = snack cracker."""


def _parse(content: str) -> list[dict] | None:
    data = json.loads(content)
    lines = data.get("lines") if isinstance(data, dict) else None
    if not isinstance(lines, list):
        return None
    clean = []
    for line in lines:
        if not isinstance(line, dict) or not str(line.get("raw_text") or "").strip():
            continue
        qty = line.get("qty")
        clean.append({
            "raw_text": str(line["raw_text"]).strip()[:300],
            "item": str(line.get("item") or "")[:120],
            "qty": int(qty) if isinstance(qty, (int, float)) and qty > 0 else None,
            "unit": line.get("unit") if line.get("unit") in ("case", "piece") else None,
            "size": str(line["size"])[:20] if line.get("size") else None,
        })
    return clean


def _groq(message: str) -> list[dict] | None:
    response = httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={"model": settings.groq_model, "temperature": 0, "response_format": {"type": "json_object"},
              "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": message}]},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return _parse(response.json()["choices"][0]["message"]["content"])


def _gemini(message: str) -> list[dict] | None:
    response = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent",
        headers={"x-goog-api-key": settings.gemini_api_key},
        json={"systemInstruction": {"parts": [{"text": SYSTEM}]},
              "contents": [{"role": "user", "parts": [{"text": message}]}],
              "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return _parse(response.json()["candidates"][0]["content"]["parts"][0]["text"])


def read_order(message: str) -> tuple[list[dict] | None, str]:
    """Returns (lines, engine name). lines is None if every provider failed or none is configured."""
    providers = []
    if settings.groq_api_key:
        providers.append((f"groq:{settings.groq_model}", _groq))
    if settings.gemini_api_key:
        providers.append((f"gemini:{settings.gemini_model}", _gemini))
    for name, call in providers:
        try:
            lines = call(message)
            if lines:
                return lines, name
        except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as error:
            log.warning("LLM provider %s failed: %s", name, error)
    return None, ""
