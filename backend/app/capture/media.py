"""Voice notes and photos of handwritten lists: check the file, then turn it into text for the normal reader.

The transcript is shown to the desk next to the original audio or photo, and goes through the same cross-checks
as a typed message. If transcription fails, the desk listens or looks and types the order instead.
"""
import base64
import logging

import httpx
from fastapi import HTTPException

from ..config import settings
from .llm import groq_post

log = logging.getLogger(__name__)
MAX_BYTES = 5 * 1024 * 1024
TIMEOUT = 60

PHOTO_PROMPT = ("This is a photo of a kirana shop's handwritten order list. Copy the text exactly as written, one "
                "product per line, keeping Hindi or Hinglish words as they are. Do not translate, correct, total or add "
                "anything. Write [unclear] for a line you cannot read. Output only the lines.")


def sniff(data: bytes) -> tuple[str, str]:
    """Identify the file from its first bytes, not from the name or the browser's claim."""
    head = data[:16]
    if head.startswith(b"ID3") or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "voice", "audio/mpeg"
    if head.startswith(b"OggS"):
        return "voice", "audio/ogg"
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return "voice", "audio/wav"
    if head[4:8] == b"ftyp":
        return "voice", "audio/mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "voice", "audio/webm"
    if head.startswith(b"\xff\xd8\xff"):
        return "photo", "image/jpeg"
    if head.startswith(b"\x89PNG"):
        return "photo", "image/png"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "photo", "image/webp"
    raise HTTPException(415, "Upload a voice note (mp3, ogg, m4a, wav) or a photo (jpg, png, webp).")


def check_upload(data: bytes) -> tuple[str, str]:
    if not data:
        raise HTTPException(422, "The file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "The file is larger than 5 MB.")
    return sniff(data)


def _voice(data: bytes, media_type: str) -> str:
    extension = {"audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav", "audio/mp4": "m4a", "audio/webm": "webm"}
    response = groq_post(
        "audio/transcriptions", timeout=TIMEOUT,
        files={"file": (f"note.{extension.get(media_type, 'mp3')}", data, media_type)},
        data={"model": settings.groq_whisper_model, "language": "hi", "temperature": "0", "response_format": "json"},
    )
    return response.json()["text"].strip()


def _photo_groq(data: bytes, media_type: str) -> str:
    image = f"data:{media_type};base64,{base64.b64encode(data).decode()}"
    # A list is short; capping the reply keeps each photo well inside the per-minute token limit.
    response = groq_post("chat/completions", timeout=TIMEOUT, json={
        "model": settings.groq_vision_model, "temperature": 0, "max_completion_tokens": 700,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PHOTO_PROMPT}, {"type": "image_url", "image_url": {"url": image}}]}]})
    return response.json()["choices"][0]["message"]["content"].strip()


def _photo_gemini(data: bytes, media_type: str) -> str:
    response = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent",
        headers={"x-goog-api-key": settings.gemini_api_key},
        json={"contents": [{"role": "user", "parts": [
            {"text": PHOTO_PROMPT}, {"inline_data": {"mime_type": media_type, "data": base64.b64encode(data).decode()}}]}],
            "generationConfig": {"temperature": 0}},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


def transcribe(kind: str, data: bytes, media_type: str) -> tuple[str | None, str]:
    """Returns (text, engine), or (None, "") when no service could read it."""
    providers = []
    if kind == "voice" and settings.groq_api_key:
        providers.append((f"groq:{settings.groq_whisper_model}", _voice))
    if kind == "photo" and settings.groq_api_key:
        providers.append((f"groq:{settings.groq_vision_model}", _photo_groq))
    if kind == "photo" and settings.gemini_api_key:
        providers.append((f"gemini:{settings.gemini_model}", _photo_gemini))
    for name, call in providers:
        try:
            text = call(data, media_type)
            if text:
                return text[:2000], name
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as error:
            log.warning("Transcription with %s failed: %s", name, error)
    return None, ""
