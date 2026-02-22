#backend/api/importer.py
from datetime import date, datetime
from typing import Optional
from sqlalchemy.orm import Session
from .models import Member, WeeklyPoints

def import_files(db: Session, gmbr: str, gexp: str, family: str, snapshot_date: Optional[date] = None):
    # gmbr
    if gmbr.startswith("gmbr"):
        gmbr = gmbr[4:].strip()

    members = {}
    for entry in gmbr.split():
        p = entry.split("|")
        if len(p) != 10:
            continue
        members[int(p[0])] = {
            "player_id": int(p[0]),
            "account_id": int(p[1]),
            "nickname": p[2],
            "level": int(p[3]),
            "class_id": int(p[4]),
            "family": family,
        }

    # upsert members
    for m in members.values():
        existing = db.get(Member, m["player_id"])
        if existing:
            for k, v in m.items():
                setattr(existing, k, v)
        else:
            db.add(Member(**m))

    # gexp
    if gexp.startswith("gexp"):
        gexp = gexp[4:].strip()

    snap = snapshot_date or date.today()
    imported_at = datetime.utcnow()

    # ✅ IMPORTANT: replace snapshot -> pas de doublons si tu réimportes
    db.query(WeeklyPoints).filter(
        WeeklyPoints.family == family,
        WeeklyPoints.snapshot_date == snap,
    ).delete(synchronize_session=False)

    for entry in gexp.split():
        p = entry.split("|")
        if len(p) != 2:
            continue
        pid, points = int(p[0]), int(p[1])
        if pid not in members:
            continue

        db.add(
            WeeklyPoints(
                snapshot_date=snap,
                imported_at=imported_at,
                family=family,
                player_id=pid,
                gexp_points=points,
            )
        )

    db.commit()