import asyncio
import json
import re
from typing import List, Optional

from app.config import settings
from app.scoring.engine import RED_FLAG_KEYWORDS, SYMPTOM_KEYWORDS, VAGUE_PHRASES

_GEMINI_TIMEOUT_SECONDS = 4.0

_PROMPT_TEMPLATE = """You are assisting an Emergency Department intake system. You do NOT decide \
triage severity - a separate deterministic engine does that. Your only job is to interpret messy, \
free-text patient-reported complaints into structured signals.

Patient age: {age}
Available vitals: {vitals}
Chief complaint (verbatim): "{chief_complaint}"

Return ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{{
  "extractedSignals": ["respiratory"|"cardiac"|"neurological"|"allergic"|"gi"|"trauma"|"infectious"|"other", ...],
  "ambiguityDetected": true|false,
  "missingFieldSuggestions": ["short string", ...],
  "narrative": "one short plain-language clinical summary sentence"
}}
"""

_VALID_SIGNALS = {"respiratory", "cardiac", "neurological", "allergic", "gi", "trauma", "infectious", "other"}


def _keyword_fallback(chief_complaint: str) -> dict:
    """Deterministic keyword-only interpretation used whenever the AI call is unavailable."""
    complaint_lower = (chief_complaint or "").lower()
    signals: List[str] = []
    for category, keywords in SYMPTOM_KEYWORDS.items():
        if category == "other":
            continue
        if any(kw in complaint_lower for kw in keywords):
            signals.append(category)

    vague = any(p in complaint_lower for p in VAGUE_PHRASES)
    no_keyword_match = not signals and not any(kw in complaint_lower for kw in RED_FLAG_KEYWORDS)
    ambiguity_detected = bool(vague and no_keyword_match)

    return {
        "available": False,
        "extractedSignals": signals,
        "ambiguityDetected": ambiguity_detected,
        "missingFieldSuggestions": [],
        "narrative": "",
    }


def _parse_gemini_json(raw_text: str) -> Optional[dict]:
    text = raw_text.strip()
    fence_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()
    try:
        data = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None

    if not isinstance(data, dict):
        return None

    signals = data.get("extractedSignals", [])
    if not isinstance(signals, list):
        return None
    signals = [s for s in signals if s in _VALID_SIGNALS]

    ambiguity = data.get("ambiguityDetected", False)
    if not isinstance(ambiguity, bool):
        return None

    suggestions = data.get("missingFieldSuggestions", [])
    if not isinstance(suggestions, list):
        suggestions = []

    narrative = data.get("narrative", "")
    if not isinstance(narrative, str):
        narrative = ""

    return {
        "available": True,
        "extractedSignals": signals,
        "ambiguityDetected": ambiguity,
        "missingFieldSuggestions": [str(s) for s in suggestions],
        "narrative": narrative,
    }


async def _call_gemini(prompt: str) -> Optional[str]:

    try:
        import google as genai
    except ImportError:
        return None

    def _sync_call() -> Optional[str]:
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(settings.gemini_model)
        response = model.generate_content(prompt)
        return getattr(response, "text", None)

    try:
        return await asyncio.wait_for(asyncio.to_thread(_sync_call), timeout=_GEMINI_TIMEOUT_SECONDS)
    except Exception:
        return None


async def interpret_intake(age: float, chief_complaint: str, vitals: dict) -> dict:
    """
    Runs once per new patient, before scoring. Always returns a well-formed
    aiInterpretation dict, falling back to keyword-only interpretation on
    any failure (missing key, API error, timeout, malformed response).
    """
    if not settings.gemini_api_key:
        return _keyword_fallback(chief_complaint)

    prompt = _PROMPT_TEMPLATE.format(age=age, vitals=json.dumps(vitals), chief_complaint=chief_complaint)
    raw = await _call_gemini(prompt)
    if raw is None:
        return _keyword_fallback(chief_complaint)

    parsed = _parse_gemini_json(raw)
    if parsed is None:
        return _keyword_fallback(chief_complaint)

    return parsed
