from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import require_roles
from .db import get_db
from .models import GameDataEntry, GameDataSync
from .noswiki import BASE_URL, SOURCES, sync_all


router = APIRouter(prefix="/game-data", tags=["game-data"])


def _summary(row):
    payload = row.payload or {}
    return {
        "kind": row.kind,
        "vnum": row.vnum,
        "name": row.name,
        "icon_id": row.icon_id,
        "icon_url": f"{BASE_URL}/images/{row.icon_id}.png" if row.icon_id else None,
        "level": payload.get("Level"),
        "hero_level": payload.get("HeroLevel"),
        "class_id": payload.get("Class"),
        "element": payload.get("Element"),
        "attack_type": payload.get("AttackType"),
        "secondary_weapon": payload.get("SecondaryWeapon"),
        "equipment_slot": payload.get("EquipmentSlot"),
        "item_type": payload.get("ItemType"),
        "item_sub_type": payload.get("ItemSubType"),
        "defence": (payload.get("Armor") or {}).get("Defence"),
        "defence_upgrade": (payload.get("Armor") or {}).get("Upgrade"),
        "resistances": payload.get("Resistances"),
        "mp_cost": payload.get("MPCost"),
        "skill_type": payload.get("Type"),
        "description_codes": payload.get("DescriptionCodes"),
        "buffs": payload.get("Buffs") or payload.get("BCards"),
        "data": payload.get("Data"),
        "pet_info": payload.get("PetInfo"),
        "is_partner": payload.get("IsValhallaPartner"),
        "monster_cards": (payload.get("Basics") or []) + (payload.get("Cards") or []),
        "cooldown": payload.get("Cooldown"),
        "range": payload.get("Range"),
        "effect_type": payload.get("Type"),
        "buff_type": payload.get("BuffType"),
        "category": payload.get("Category"),
        "effects": payload.get("Effects"),
        "sub_type": payload.get("SubType"),
        "first_data": payload.get("FirstData"),
        "second_data": payload.get("SecondData"),
        "third_data": payload.get("ThirdData"),
    }


@router.get("/status")
def status(db: Session = Depends(get_db)):
    rows = db.query(GameDataSync).order_by(GameDataSync.kind).all()
    return [{"kind": row.kind, "count": row.count, "synced_at": row.synced_at, "source_url": row.source_url} for row in rows]


@router.post("/sync")
def synchronize(
    db: Session = Depends(get_db),
    _user=Depends(require_roles("superadmin")),
):
    return {"ok": True, "counts": sync_all(db)}


@router.get("/{kind}")
def list_entries(
    kind: str,
    q: str = Query("", max_length=100),
    limit: int = Query(200, ge=1, le=8000),
    db: Session = Depends(get_db),
):
    if kind not in SOURCES:
        raise HTTPException(status_code=404, detail="Unknown game-data kind")
    query = db.query(GameDataEntry).filter(GameDataEntry.kind == kind)
    if q.strip():
        needle = f"%{q.strip().lower()}%"
        query = query.filter(func.lower(GameDataEntry.name).like(needle))
    rows = query.order_by(GameDataEntry.name, GameDataEntry.vnum).limit(limit).all()
    return [_summary(row) for row in rows]


@router.get("/{kind}/{vnum}")
def get_entry(kind: str, vnum: int, db: Session = Depends(get_db)):
    row = db.get(GameDataEntry, (kind, vnum))
    if not row:
        raise HTTPException(status_code=404, detail="Game-data entry not found")
    result = _summary(row)
    result["payload"] = row.payload
    return result
