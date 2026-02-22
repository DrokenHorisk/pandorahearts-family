# backend/api/main.py
from fastapi import FastAPI, Depends, UploadFile, File, Query, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sqlalchemy import desc, func, distinct
from typing import Optional
from datetime import datetime, date, timedelta
from collections import defaultdict
import time
from pydantic import BaseModel
from fastapi import Body

from .db import engine, get_db
from .models import Base, Member, WeeklyPoints
from .importer import import_files

from .auth import authenticate_user, create_access_token, get_current_user, require_roles

app = FastAPI(title="PandoraHearts API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],  # important pour Authorization
)

@app.on_event("startup")
def on_startup():
    for _ in range(30):
        try:
            Base.metadata.create_all(bind=engine)
            return
        except OperationalError:
            time.sleep(1)

@app.get("/health")
def health():
    return {"status": "ok"}

# ---------------- AUTH ----------------

@app.post("/auth/login")
def login(username: str = Form(...), password: str = Form(...)):
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Bad credentials")

    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "role": user["role"], "username": user["username"]}

@app.get("/auth/me")
def me(user=Depends(get_current_user)):
    return user

# ------------- IMPORT (PROTÉGÉ) -------------

@app.post("/family/{family}/import")
async def import_family(
    family: str,
    gmbr: UploadFile = File(...),
    gexp: UploadFile = File(...),
    snapshot_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),  # 🔒
):
    gmbr_txt = (await gmbr.read()).decode("utf-8", errors="replace")
    gexp_txt = (await gexp.read()).decode("utf-8", errors="replace")

    snap = None
    if snapshot_date:
        snap = datetime.strptime(snapshot_date, "%Y-%m-%d").date()

    import_files(db, gmbr_txt, gexp_txt, family, snapshot_date=snap)
    return {"status": "imported", "family": family, "snapshot_date": (snap.isoformat() if snap else None)}

# ---------------- PUBLIC API ----------------

@app.get("/family/{family}/latest")
def latest(family: str, db: Session = Depends(get_db)):
    latest_date = (
        db.query(func.max(WeeklyPoints.snapshot_date))
        .filter(WeeklyPoints.family == family)
        .scalar()
    )
    if not latest_date:
        return []

    rows = (
        db.query(
            Member.player_id,
            Member.nickname,
            Member.level,
            Member.class_id,
            WeeklyPoints.gexp_points,
            WeeklyPoints.snapshot_date,
            WeeklyPoints.imported_at,
        )
        .join(WeeklyPoints, WeeklyPoints.player_id == Member.player_id)
        .filter(WeeklyPoints.family == family)
        .filter(WeeklyPoints.snapshot_date == latest_date)
        .order_by(desc(WeeklyPoints.gexp_points))
        .all()
    )

    return [
        {
            "player_id": r[0],
            "nickname": r[1],
            "level": r[2],
            "class_id": r[3],
            "gexp_points": int(r[4]),
            "snapshot_date": r[5].isoformat() if r[5] else None,
            "imported_at": r[6].isoformat() if r[6] else None,
        }
        for r in rows
    ]

@app.get("/family/{family}/snapshots")
def list_snapshots(family: str, db: Session = Depends(get_db)):
    rows = (
        db.query(distinct(WeeklyPoints.snapshot_date))
        .filter(WeeklyPoints.family == family)
        .order_by(WeeklyPoints.snapshot_date)
        .all()
    )
    return [r[0].isoformat() for r in rows]

@app.get("/family/{family}/history")
def history(
    family: str,
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
):
    rows_dates = (
        db.query(distinct(WeeklyPoints.snapshot_date))
        .filter(
            WeeklyPoints.family == family,
            WeeklyPoints.snapshot_date.between(from_date, to_date),
        )
        .order_by(WeeklyPoints.snapshot_date)
        .all()
    )
    dates = [d[0] for d in rows_dates]

    members = db.query(Member).filter(Member.family == family).all()

    rows = (
        db.query(
            WeeklyPoints.player_id,
            WeeklyPoints.snapshot_date,
            WeeklyPoints.gexp_points,
        )
        .filter(
            WeeklyPoints.family == family,
            WeeklyPoints.snapshot_date.between(from_date, to_date),
        )
        .all()
    )

    points_map = defaultdict(dict)
    for pid, snap, pts in rows:
        points_map[pid][snap] = int(pts)

    last_date = dates[-1] if dates else None
    prev_date = dates[-2] if len(dates) >= 2 else None

    monthly_ref = None
    if last_date:
        target = last_date - timedelta(days=30)
        candidates = [d for d in dates if d <= target]
        if candidates:
            monthly_ref = candidates[-1]

    result = []

    for m in members:
        player_points = {}
        for d in dates:
            player_points[d.isoformat()] = int(points_map.get(m.player_id, {}).get(d, 0))

        last_val = int(points_map.get(m.player_id, {}).get(last_date, 0)) if last_date else 0

        period_diff = None
        if dates:
            first_val = int(points_map.get(m.player_id, {}).get(dates[0], 0))
            period_diff = last_val - first_val

        weekly_diff = None
        if last_date and prev_date:
            weekly_diff = int(points_map.get(m.player_id, {}).get(last_date, 0)) - int(
                points_map.get(m.player_id, {}).get(prev_date, 0)
            )

        monthly_diff = None
        if last_date and monthly_ref:
            monthly_diff = int(points_map.get(m.player_id, {}).get(last_date, 0)) - int(
                points_map.get(m.player_id, {}).get(monthly_ref, 0)
            )

        result.append(
            {
                "player_id": m.player_id,
                "nickname": m.nickname,
                "level": m.level,
                "class_id": m.class_id,
                "points": player_points,
                "last_value": last_val,
                "period_diff": period_diff,
                "weekly_diff": weekly_diff,
                "monthly_diff": monthly_diff,
                "monthly_ref": monthly_ref.isoformat() if monthly_ref else None,
            }
        )

    return {"dates": [d.isoformat() for d in dates], "players": result}

@app.get("/family/{family}/player/by-nickname/{nickname}")
def get_player_by_nickname(
    family: str,
    nickname: str,
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
):
    player = (
        db.query(Member)
        .filter(
            Member.family == family,
            func.lower(Member.nickname) == func.lower(nickname),
        )
        .first()
    )

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    rows_dates = (
        db.query(distinct(WeeklyPoints.snapshot_date))
        .filter(
            WeeklyPoints.family == family,
            WeeklyPoints.snapshot_date.between(from_date, to_date),
        )
        .order_by(WeeklyPoints.snapshot_date)
        .all()
    )
    dates = [d[0] for d in rows_dates]

    rows = (
        db.query(WeeklyPoints.snapshot_date, WeeklyPoints.gexp_points)
        .filter(
            WeeklyPoints.family == family,
            WeeklyPoints.player_id == player.player_id,
            WeeklyPoints.snapshot_date.between(from_date, to_date),
        )
        .all()
    )

    points_map = {snap: int(pts) for snap, pts in rows}

    series = {}
    for d in dates:
        series[d.isoformat()] = int(points_map.get(d, 0))

    last_date = dates[-1] if dates else None
    prev_date = dates[-2] if len(dates) >= 2 else None

    monthly_ref = None
    if last_date:
        target = last_date - timedelta(days=30)
        candidates = [d for d in dates if d <= target]
        if candidates:
            monthly_ref = candidates[-1]

    last_val = int(points_map.get(last_date, 0)) if last_date else 0
    first_val = int(points_map.get(dates[0], 0)) if dates else 0

    period_diff = last_val - first_val if dates else None
    weekly_diff = (
        int(points_map.get(last_date, 0)) - int(points_map.get(prev_date, 0))
        if last_date and prev_date
        else None
    )
    monthly_diff = (
        int(points_map.get(last_date, 0)) - int(points_map.get(monthly_ref, 0))
        if last_date and monthly_ref
        else None
    )

    return {
        "player": {
            "player_id": player.player_id,
            "nickname": player.nickname,
            "level": player.level,
            "class_id": player.class_id,
        },
        "dates": [d.isoformat() for d in dates],
        "series": series,
        "stats": {
            "last_value": last_val,
            "period_diff": period_diff,
            "weekly_diff": weekly_diff,
            "monthly_diff": monthly_diff,
            "monthly_ref": monthly_ref.isoformat() if monthly_ref else None,
        },
    }
    
class NicknameUpdate(BaseModel):
    nickname: str

@app.patch("/family/{family}/player/{player_id}/nickname")
def update_nickname(
    family: str,
    player_id: int,
    payload: NicknameUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),  # 🔒 Admin/Droken only
):
    new_nick = (payload.nickname or "").strip()

    if not new_nick:
        raise HTTPException(status_code=400, detail="Nickname cannot be empty")

    if len(new_nick) > 64:
        raise HTTPException(status_code=400, detail="Nickname too long (max 64)")

    # joueur existe ?
    m = (
        db.query(Member)
        .filter(Member.family == family, Member.player_id == player_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Player not found")

    # éviter doublon pseudo dans la famille
    exists = (
        db.query(Member)
        .filter(
            Member.family == family,
            func.lower(Member.nickname) == func.lower(new_nick),
            Member.player_id != player_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Nickname already used in this family")

    m.nickname = new_nick
    db.commit()
    db.refresh(m)

    return {
        "player_id": m.player_id,
        "nickname": m.nickname,
        "level": m.level,
        "class_id": m.class_id,
        "family": m.family,
    }