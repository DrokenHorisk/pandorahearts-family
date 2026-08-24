# backend/api/main.py
from fastapi import FastAPI, Depends, UploadFile, File, Query, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sqlalchemy import desc, func, distinct
from typing import Optional, Literal
from datetime import datetime, date, timedelta
from collections import defaultdict
import time
from pydantic import BaseModel

from .db import engine, get_db
from .models import Base, Member, WeeklyPoints, Donation
from .importer import import_files

from .auth import authenticate_user, create_access_token, get_current_user, require_roles
from .calculator import router as calculator_router
from .game_data import router as game_data_router

app = FastAPI(title="PandoraHearts API")
app.include_router(calculator_router)
app.include_router(game_data_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://pandorahearts-family.fr",
        "http://localhost:5173",  # pratique en dev si besoin
    ],
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
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "username": user["username"],
    }

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
    _user=Depends(require_roles("admin", "superadmin")),
):
    gmbr_txt = (await gmbr.read()).decode("utf-8", errors="replace")
    gexp_txt = (await gexp.read()).decode("utf-8", errors="replace")

    snap = None
    if snapshot_date:
        snap = datetime.strptime(snapshot_date, "%Y-%m-%d").date()

    import_files(db, gmbr_txt, gexp_txt, family, snapshot_date=snap)
    return {
        "status": "imported",
        "family": family,
        "snapshot_date": (snap.isoformat() if snap else None),
    }

# ---------------- Helpers ----------------

ROLE_DEFAULT = "Principale"

def normalize_role(role: Optional[str]) -> str:
    if role in ("Principale", "Secondaire", "Mule"):
        return role
    return ROLE_DEFAULT

STATUS_DEFAULT = None

def normalize_status(status: Optional[str]) -> Optional[str]:
    if status in ("actif", "absent", "arret_sans_nouvelle"):
        return status
    return STATUS_DEFAULT

def require_usernames(*allowed: str):
    allowed_set = {a.lower() for a in allowed}

    def _dep(user=Depends(get_current_user)):
        username = (user.get("username") or user.get("sub") or "").lower()
        if username not in allowed_set:
            raise HTTPException(status_code=403, detail="Not allowed")
        return user

    return _dep

def pick_monthly_ref_4w_sunday(dates: list[date]) -> Optional[date]:
    """
    Mensuel = 4 semaines (28 jours).
    On essaie de prendre une date de snapshot <= (last_date - 28 jours)
    ET de préférence un dimanche.
    Fallback: la dernière date <= target, même si pas dimanche.
    """
    if not dates:
        return None

    last_date = dates[-1]
    target = last_date - timedelta(days=28)

    candidates = [d for d in dates if d <= target]
    if not candidates:
        return None

    sundays = [d for d in candidates if d.weekday() == 6]
    if sundays:
        return sundays[-1]

    return candidates[-1]

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

    all_dates_rows = (
        db.query(distinct(WeeklyPoints.snapshot_date))
        .filter(WeeklyPoints.family == family)
        .order_by(WeeklyPoints.snapshot_date)
        .all()
    )
    all_dates = [d[0] for d in all_dates_rows]

    members = db.query(Member).filter(Member.family == family).all()
    nickname_by_id = {int(m.player_id): m.nickname for m in members}

    rows = (
        db.query(
            WeeklyPoints.player_id,
            WeeklyPoints.snapshot_date,
            WeeklyPoints.gexp_points,
        )
        .filter(
            WeeklyPoints.family == family,
            WeeklyPoints.snapshot_date.in_(all_dates),
        )
        .all()
    )

    points_map = defaultdict(dict)
    for pid, snap, pts in rows:
        points_map[int(pid)][snap] = int(pts)

    last_date = dates[-1] if dates else None

    prev_global_date = None
    if last_date and last_date in all_dates:
        idx = all_dates.index(last_date)
        if idx > 0:
            prev_global_date = all_dates[idx - 1]

    monthly_ref_global = None
    if last_date:
        target = last_date - timedelta(days=28)
        candidates = [d for d in all_dates if d <= target]
        if candidates:
            monthly_ref_global = candidates[-1]

    result = []

    for m in members:
        pid = int(m.player_id)
        role = normalize_role(getattr(m, "role", None))
        status = normalize_status(getattr(m, "status", None))

        player_points = {
            d.isoformat(): int(points_map.get(pid, {}).get(d, 0)) for d in dates
        }

        last_val = int(points_map.get(pid, {}).get(last_date, 0)) if last_date else 0

        period_diff = None
        if dates:
            first_val = int(points_map.get(pid, {}).get(dates[0], 0))
            period_diff = last_val - first_val

        weekly_diff = None
        if last_date and prev_global_date:
            weekly_diff = (
                int(points_map.get(pid, {}).get(last_date, 0))
                - int(points_map.get(pid, {}).get(prev_global_date, 0))
            )

        monthly_diff = None
        if last_date and monthly_ref_global:
            monthly_diff = (
                int(points_map.get(pid, {}).get(last_date, 0))
                - int(points_map.get(pid, {}).get(monthly_ref_global, 0))
            )

        main_nickname = None
        if m.main_player_id:
            main_nickname = nickname_by_id.get(int(m.main_player_id))

        result.append(
            {
                "player_id": pid,
                "nickname": m.nickname,
                "level": m.level,
                "class_id": m.class_id,
                "role": role,
                "status": status,
                "main_player_id": int(m.main_player_id) if m.main_player_id else None,
                "main_nickname": main_nickname,
                "points": player_points,
                "last_value": last_val,
                "period_diff": period_diff,
                "weekly_diff": weekly_diff,
                "monthly_diff": monthly_diff,
                "monthly_ref": monthly_ref_global.isoformat() if monthly_ref_global else None,
            }
        )

    return {
        "dates": [d.isoformat() for d in dates],
        "players": result,
    }

@app.get("/family/{family}/donations")
def get_donations(
    family: str,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    rows = db.query(Donation).filter(Donation.family == family).all()
    return {
        str(d.player_id): {"gave": bool(d.gave), "amount": int(d.amount)}
        for d in rows
    }

@app.put("/family/{family}/donations/{player_id}")
def upsert_donation(
    family: str,
    player_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    gave = bool(payload.get("gave", False))
    amount = int(payload.get("amount", 0))

    row = (
        db.query(Donation)
        .filter(Donation.family == family, Donation.player_id == player_id)
        .first()
    )

    if not row:
        row = Donation(family=family, player_id=player_id, gave=gave, amount=amount)
        db.add(row)
    else:
        row.gave = gave
        row.amount = amount

    db.commit()
    return {"ok": True}

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

    monthly_ref = pick_monthly_ref_4w_sunday(dates)

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

    role = normalize_role(getattr(player, "role", None))
    status = normalize_status(getattr(player, "status", None))

    main_nickname = None
    if player.main_player_id:
        main_obj = (
            db.query(Member)
            .filter(Member.family == family, Member.player_id == player.main_player_id)
            .first()
        )
        main_nickname = main_obj.nickname if main_obj else None

    linked = []
    if role == "Principale":
        linked_rows = (
            db.query(
                Member.player_id,
                Member.nickname,
                Member.role,
                Member.level,
                Member.class_id,
            )
            .filter(Member.family == family, Member.main_player_id == player.player_id)
            .order_by(func.lower(Member.nickname))
            .all()
        )
        linked = [
            {
                "player_id": int(r[0]),
                "nickname": r[1],
                "role": normalize_role(r[2]),
                "level": r[3],
                "class_id": r[4],
            }
            for r in linked_rows
        ]

    return {
        "player": {
            "player_id": int(player.player_id),
            "nickname": player.nickname,
            "level": player.level,
            "class_id": player.class_id,
            "role": role,
            "status": status,
            "main_player_id": int(player.main_player_id) if player.main_player_id else None,
            "main_nickname": main_nickname,
            "linked_members": linked,
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

# ---------------- ADMIN API ----------------

class NicknameUpdate(BaseModel):
    nickname: str

@app.patch("/family/{family}/player/{player_id}/nickname")
def update_nickname(
    family: str,
    player_id: int,
    payload: NicknameUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    new_nick = (payload.nickname or "").strip()

    if not new_nick:
        raise HTTPException(status_code=400, detail="Nickname cannot be empty")

    if len(new_nick) > 64:
        raise HTTPException(status_code=400, detail="Nickname too long (max 64)")

    m = (
        db.query(Member)
        .filter(Member.family == family, Member.player_id == player_id)
        .first()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Player not found")

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
        "player_id": int(m.player_id),
        "nickname": m.nickname,
        "level": m.level,
        "class_id": m.class_id,
        "family": m.family,
    }

class PointsUpdate(BaseModel):
    snapshot_date: date
    value: int

@app.patch("/family/{family}/players/{player_id}/points")
def update_player_points(
    family: str,
    player_id: int,
    payload: PointsUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    if payload.value < 0:
        raise HTTPException(status_code=400, detail="value must be >= 0")

    member = (
        db.query(Member)
        .filter(Member.family == family, Member.player_id == player_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Player not found")

    row = (
        db.query(WeeklyPoints)
        .filter(
            WeeklyPoints.family == family,
            WeeklyPoints.player_id == player_id,
            WeeklyPoints.snapshot_date == payload.snapshot_date,
        )
        .first()
    )

    if row:
        row.gexp_points = int(payload.value)
        db.commit()
        db.refresh(row)
        return {
            "status": "updated",
            "family": family,
            "player_id": int(player_id),
            "snapshot_date": row.snapshot_date.isoformat(),
            "gexp_points": int(row.gexp_points),
        }

    new_row = WeeklyPoints(
        family=family,
        player_id=player_id,
        snapshot_date=payload.snapshot_date,
        gexp_points=int(payload.value),
        imported_at=datetime.utcnow(),
    )
    db.add(new_row)
    db.commit()
    db.refresh(new_row)

    return {
        "status": "created",
        "family": family,
        "player_id": int(player_id),
        "snapshot_date": new_row.snapshot_date.isoformat(),
        "gexp_points": int(new_row.gexp_points),
    }

@app.delete("/family/{family}/players/{player_id}")
def delete_player(
    family: str,
    player_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    member = (
        db.query(Member)
        .filter(Member.family == family, Member.player_id == player_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Player not found")

    linked = (
        db.query(Member)
        .filter(Member.family == family, Member.main_player_id == player_id)
        .all()
    )
    for lm in linked:
        lm.main_player_id = None
        lm.role = "Principale"

    db.query(WeeklyPoints).filter(
        WeeklyPoints.family == family,
        WeeklyPoints.player_id == player_id,
    ).delete(synchronize_session=False)

    db.query(Donation).filter(
        Donation.family == family,
        Donation.player_id == player_id,
    ).delete(synchronize_session=False)

    db.delete(member)
    db.commit()

    return {"status": "deleted", "family": family, "player_id": int(player_id)}

@app.get("/family/{family}/mains")
def list_mains(family: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Member.player_id, Member.nickname)
        .filter(Member.family == family, Member.role == "Principale")
        .order_by(func.lower(Member.nickname))
        .all()
    )
    return [{"player_id": int(r[0]), "nickname": r[1]} for r in rows]

class RoleLinkUpdate(BaseModel):
    role: Literal["Principale", "Secondaire", "Mule"]
    main_player_id: Optional[int] = None

@app.patch("/family/{family}/player/{player_id}/role-link")
def update_role_and_link(
    family: str,
    player_id: int,
    payload: RoleLinkUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    role = payload.role
    main_id = payload.main_player_id

    member = (
        db.query(Member)
        .filter(Member.family == family, Member.player_id == player_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Player not found")

    if role == "Principale":
        if main_id is not None:
            raise HTTPException(status_code=400, detail="Principale ne peut pas avoir main_player_id")
        member.role = "Principale"
        member.main_player_id = None
        db.commit()
        db.refresh(member)
        return {"player_id": int(member.player_id), "role": member.role, "main_player_id": None}

    if main_id is None:
        raise HTTPException(
            status_code=400,
            detail="Secondaire/Mule doit être lié à un principal (main_player_id obligatoire)",
        )

    if int(main_id) == int(player_id):
        raise HTTPException(status_code=400, detail="Impossible de se lier à soi-même")

    main_member = (
        db.query(Member)
        .filter(Member.family == family, Member.player_id == int(main_id))
        .first()
    )
    if not main_member:
        raise HTTPException(status_code=404, detail="Principal introuvable dans cette family")

    if normalize_role(getattr(main_member, "role", None)) != "Principale":
        raise HTTPException(status_code=409, detail="main_player_id doit pointer vers un membre role=Principale")

    member.role = role
    member.main_player_id = int(main_id)

    db.commit()
    db.refresh(member)

    return {
        "player_id": int(member.player_id),
        "role": member.role,
        "main_player_id": int(member.main_player_id) if member.main_player_id else None,
    }

class StatusUpdate(BaseModel):
    status: Optional[Literal["actif", "absent", "arret_sans_nouvelle"]] = None

@app.patch("/family/{family}/player/{player_id}/status")
def update_status(
    family: str,
    player_id: int,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    member = (
        db.query(Member)
        .filter(Member.family == family, Member.player_id == player_id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="Player not found")

    member.status = payload.status

    db.commit()
    db.refresh(member)

    return {
        "player_id": int(member.player_id),
        "status": normalize_status(getattr(member, "status", None)),
    }

class ManualPlayerCreate(BaseModel):
    player_id: int
    nickname: str
    level: int
    class_id: Literal[0, 1, 2, 3, 4]
    role: Literal["Principale", "Secondaire", "Mule"] = "Principale"
    status: Optional[Literal["actif", "absent", "arret_sans_nouvelle"]] = None
    main_player_id: Optional[int] = None


@app.post("/family/{family}/players")
def create_player(
    family: str,
    payload: ManualPlayerCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "superadmin")),
):
    nickname = (payload.nickname or "").strip()

    if not nickname:
        raise HTTPException(status_code=400, detail="Nickname cannot be empty")

    if len(nickname) > 64:
        raise HTTPException(status_code=400, detail="Nickname too long (max 64)")

    if payload.level < 1:
        raise HTTPException(status_code=400, detail="Level must be >= 1")

    # Vérifie player_id unique
    existing_player = db.get(Member, int(payload.player_id))
    if existing_player:
        raise HTTPException(status_code=409, detail="player_id already exists")

    # Vérifie nickname unique
    existing_nickname = (
        db.query(Member)
        .filter(
            Member.family == family,
            func.lower(Member.nickname) == func.lower(nickname),
        )
        .first()
    )
    if existing_nickname:
        raise HTTPException(status_code=409, detail="Nickname already used in this family")

    role = payload.role
    main_id = payload.main_player_id

    # Gestion rôle / lien
    if role == "Principale":
        main_id = None
    else:
        if main_id is None:
            raise HTTPException(
                status_code=400,
                detail="Secondaire/Mule doit être lié à un principal",
            )

        if int(main_id) == int(payload.player_id):
            raise HTTPException(status_code=400, detail="Impossible de se lier à soi-même")

        main_member = (
            db.query(Member)
            .filter(Member.family == family, Member.player_id == int(main_id))
            .first()
        )
        if not main_member:
            raise HTTPException(status_code=404, detail="Principal introuvable")

        if normalize_role(getattr(main_member, "role", None)) != "Principale":
            raise HTTPException(
                status_code=409,
                detail="main_player_id doit pointer vers un Principale",
            )

    # Création
    member = Member(
        player_id=int(payload.player_id),
        nickname=nickname,
        level=int(payload.level),
        class_id=int(payload.class_id),
        family=family,
        role=role,
        status=payload.status,
        main_player_id=int(main_id) if main_id else None,
    )

    db.add(member)
    db.commit()
    db.refresh(member)

    return {
        "status": "created",
        "player": {
            "player_id": int(member.player_id),
            "nickname": member.nickname,
            "level": int(member.level),
            "class_id": int(member.class_id),
            "role": normalize_role(member.role),
            "status": normalize_status(member.status),
            "main_player_id": member.main_player_id,
        },
    }