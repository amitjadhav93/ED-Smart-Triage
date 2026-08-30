from typing import Optional

from fastapi import Header

from app.config import settings
from app.errors import APIError


def require_clinician_auth(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise APIError(401, "Missing or malformed Authorization header.", "UNAUTHORIZED")

    token = authorization.split(" ", 1)[1].strip()
    if not token or token not in settings.clinician_tokens:
        raise APIError(401, "Invalid clinician token.", "UNAUTHORIZED")

    return token
