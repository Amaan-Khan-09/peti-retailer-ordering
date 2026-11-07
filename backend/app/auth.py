import hashlib
import hmac
import secrets
from datetime import timedelta

import jwt
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db, utcnow
from .models import OtpCode, User

COOKIE = "peti_session"
SESSION_HOURS = 12
OTP_MINUTES = 5
MAX_ATTEMPTS = 5
MAX_CODES_PER_15_MIN = 5


def _hash(phone: str, code: str) -> str:
    return hmac.new(settings.jwt_secret.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def issue_otp(db: Session, phone: str) -> str | None:
    """Returns the code for registered numbers (SMS is mocked); None for unknown numbers."""
    recent = db.scalar(select(func.count(OtpCode.id)).where(
        OtpCode.phone == phone, OtpCode.created_at > utcnow() - timedelta(minutes=15)))
    if recent >= MAX_CODES_PER_15_MIN:
        raise HTTPException(429, "Too many codes requested. Try again in 15 minutes.")
    if not db.scalar(select(User).where(User.phone == phone)):
        return None
    code = f"{secrets.randbelow(10**6):06d}"
    db.add(OtpCode(phone=phone, code_hash=_hash(phone, code), expires_at=utcnow() + timedelta(minutes=OTP_MINUTES)))
    db.commit()
    return code


def verify_otp(db: Session, phone: str, code: str) -> User:
    otp = db.scalar(select(OtpCode).where(OtpCode.phone == phone, OtpCode.used.is_(False))
                    .order_by(OtpCode.created_at.desc()))
    if not otp:  # unknown numbers land here too, with the same answer as a wrong code
        raise HTTPException(400, "That code is not right. Check the 6 digits, or request a new code.")
    if otp.attempts >= MAX_ATTEMPTS:
        raise HTTPException(400, "Too many wrong tries. Request a new code.")
    if otp.expires_at < utcnow():
        raise HTTPException(400, "This code has expired. Request a new one.")
    otp.attempts += 1
    if not hmac.compare_digest(otp.code_hash, _hash(phone, code)):
        db.commit()
        raise HTTPException(400, "That code is not right. Check the 6 digits and try again.")
    otp.used = True
    db.commit()
    return db.scalar(select(User).where(User.phone == phone))


def start_session(response: Response, user: User) -> None:
    token = jwt.encode({"sub": str(user.id), "role": user.role, "exp": utcnow() + timedelta(hours=SESSION_HOURS)},
                       settings.jwt_secret, algorithm="HS256")
    response.set_cookie(COOKIE, token, httponly=True, samesite="lax", secure=settings.cookie_secure,
                        max_age=SESSION_HOURS * 3600)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Please sign in")
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has ended. Please sign in again.")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "Please sign in")
    return user


def require_role(*roles: str):
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "You don't have access to this")
        return user
    return dependency


require_desk = require_role("desk")
require_retailer = require_role("retailer")
