from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .auth import get_current_user
from .db import get_db
from .models import CalculatorProfile


router = APIRouter(prefix="/calculator", tags=["calculator"])


class CalculatorProfilePayload(BaseModel):
    profile: Dict[str, Any]


@router.get("/profile")
def get_calculator_profile(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    row = db.get(CalculatorProfile, user["username"])
    if not row:
        raise HTTPException(status_code=404, detail="Calculator profile not found")
    return {"profile": row.profile}


@router.put("/profile")
def save_calculator_profile(
    payload: CalculatorProfilePayload,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    profile = payload.profile
    required = {"character", "combat", "weapon", "fairies", "specialists"}
    if not required.issubset(profile):
        raise HTTPException(status_code=422, detail="Incomplete calculator profile")

    username = user["username"]
    row = db.get(CalculatorProfile, username)
    if row:
        row.profile = profile
    else:
        row = CalculatorProfile(username=username, profile=profile)
        db.add(row)

    db.commit()
    return {"ok": True}
