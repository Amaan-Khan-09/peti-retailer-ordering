from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from ..auth import COOKIE, current_user, issue_otp, start_session, verify_otp
from ..config import settings
from ..db import get_db
from ..models import User
from ..orders import audit, exposure, f
from ..schemas import OtpRequest, VerifyRequest

router = APIRouter(prefix="/api", tags=["auth"])


def me_json(db: Session, user: User) -> dict:
    data = {"id": user.id, "name": user.name, "role": user.role, "phone": user.phone[-4:].rjust(10, "•")}
    if user.retailer:
        r = user.retailer
        used = exposure(db, r)
        data["retailer"] = {"id": r.id, "code": r.code, "shop_name": r.shop_name, "area": r.area,
                            "credit_limit": f(r.credit_limit), "credit_used": f(used),
                            "credit_available": f(max(r.credit_limit - used, 0))}
    return data


@router.post("/auth/otp")
def request_otp(body: OtpRequest, db: Session = Depends(get_db)):
    code = issue_otp(db, body.phone)
    # Same answer for unknown numbers, so the form can't be used to find registered shops.
    return {"sent": True, "demo_code": code if settings.demo_mode else None}


@router.post("/auth/verify")
def verify(body: VerifyRequest, response: Response, db: Session = Depends(get_db)):
    user = verify_otp(db, body.phone, body.code)
    start_session(response, user)
    audit(db, user, "auth.login")
    db.commit()
    return me_json(db, user)


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return me_json(db, user)
