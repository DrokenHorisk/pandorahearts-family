import html
import io
import json
import re
import subprocess
from functools import lru_cache
from pathlib import Path
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from PIL import Image
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import require_roles
from .db import get_db
from .models import GameDataEntry, GameDataSync
from .noswiki import BASE_URL, SOURCES, sync_all


router = APIRouter(prefix="/game-data", tags=["game-data"])

PARTNER_RANKS = ("F", "E", "D", "C", "B", "A", "S")
PARTNER_DATA_PATH = Path(__file__).with_name("data") / "partner_specialists.json"
with PARTNER_DATA_PATH.open(encoding="utf-8") as partner_data_file:
    PARTNER_SPECIALISTS = json.load(partner_data_file)


def _plain_text(value: str):
    value = re.sub(r"<img[^>]*>", "", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip(" .\n\t")


@lru_cache(maxsize=256)
def _partner_specialist(vnum: int):
    request = Request(
        f"https://nosapki.com/fr/items/{vnum}",
        headers={"User-Agent": "PandoraHearts/1.0"},
    )
    with urlopen(request, timeout=30) as response:
        document = response.read().decode("utf-8", errors="replace")

    # Chaque fiche contient 3 compétences, chacune déclinée dans les 7 rangs.
    chunks = re.split(r'<div class="partner_skill_einfo"', document)[1:]
    ranks = {rank: [] for rank in PARTNER_RANKS}
    for chunk in chunks:
        level_match = re.search(r'data-skill-level="([0-6])"', chunk)
        name_match = re.search(r"<p class=['\"]name['\"]>(.*?)</p>", chunk, re.S)
        if not level_match or not name_match:
            continue
        level = int(level_match.group(1))
        icon_match = re.search(r"<img class=['\"]icon['\"] src=['\"]([^'\"]+)", chunk)
        bonus_match = re.search(r"<div class=['\"]bonus['\"]>(.*?)</div>", chunk, re.S)
        effects = []
        if bonus_match:
            effects = [_plain_text(value) for value in re.findall(r"<p>(.*?)</p>", bonus_match.group(1), re.S)]
        ranks[PARTNER_RANKS[level]].append({
            "name": _plain_text(name_match.group(1)),
            "icon_url": f"https://nosapki.com{icon_match.group(1)}" if icon_match and icon_match.group(1).startswith("/") else (icon_match.group(1) if icon_match else None),
            "effects": [value for value in effects if value],
        })
    if not any(ranks.values()):
        raise ValueError("No partner skills found")
    return {"vnum": vnum, "ranks": ranks}


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
        "specialist": payload.get("SP"),
        "item_vnum": payload.get("ItemVnum"),
        "equipment_slot": payload.get("EquipmentSlot"),
        "item_type": payload.get("ItemType"),
        "item_sub_type": payload.get("ItemSubType"),
        "defence": (payload.get("Armor") or {}).get("Defence"),
        "defence_upgrade": (payload.get("Armor") or {}).get("Upgrade"),
        "resistances": payload.get("Resistances"),
        "mp_cost": payload.get("MPCost"),
        "power": payload.get("Damage") or payload.get("Power") or payload.get("SkillPower") or 0,
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


@router.post("/ocr-character-sheet")
async def ocr_character_sheet(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Le fichier doit être une image.")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="L’image est vide.")
    if len(payload) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="L’image dépasse 12 Mo.")
    try:
        result = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", "fra", "--psm", "6", "preserve_interword_spaces=1"],
            input=payload,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=90,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="La lecture OCR a dépassé 90 secondes.") from exc
    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()[-500:] or "Tesseract n’a pas pu lire l’image."
        raise HTTPException(status_code=422, detail=detail)
    text = result.stdout.decode("utf-8", errors="replace")
    header_numbers = []
    identity_texts = []
    regions = {"equipment": {}, "accessories": {}}
    header_text = ""
    try:
        image = Image.open(io.BytesIO(payload))

        header = image.crop((int(image.width * 0.68), 0, image.width, int(image.height * 0.06)))
        header = header.resize((header.width * 4, header.height * 4), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        header.save(output, format="PNG")
        header_result = subprocess.run(
            ["tesseract", "stdin", "stdout", "-l", "eng", "--psm", "6", "-c", "tessedit_char_whitelist=0123456789 "],
            input=output.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, check=False,
        )
        header_text = header_result.stdout.decode("utf-8", errors="replace")
        header_numbers = [int(value) for value in re.findall(r"\b\d{1,3}\b", header_text)][-3:]

        identity = image.crop((0, 0, int(image.width * 0.70), int(image.height * 0.06)))
        identity = identity.resize((identity.width * 4, identity.height * 4), Image.Resampling.LANCZOS)
        identity_output = io.BytesIO()
        identity.save(identity_output, format="PNG")
        for psm in (11, 6):
            identity_result = subprocess.run(
                ["tesseract", "stdin", "stdout", "-l", "fra", "--psm", str(psm)],
                input=identity_output.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, check=False,
            )
            identity_texts.append(identity_result.stdout.decode("utf-8", errors="replace"))

        equipment_boxes = {
            "main": (0.015, 0.065, 0.34, 0.18),
            "secondary": (0.335, 0.065, 0.665, 0.18),
            "armor": (0.66, 0.065, 0.985, 0.18),
        }
        for slot, (left, top, right, bottom) in equipment_boxes.items():
            crop = image.crop((
                int(image.width * left), int(image.height * top),
                int(image.width * right), int(image.height * bottom),
            ))
            crop = crop.resize((crop.width * 3, crop.height * 3), Image.Resampling.LANCZOS)
            crop_output = io.BytesIO()
            crop.save(crop_output, format="PNG")
            crop_result = subprocess.run(
                ["tesseract", "stdin", "stdout", "-l", "fra", "--psm", "6"],
                input=crop_output.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=25, check=False,
            )
            regions["equipment"][slot] = crop_result.stdout.decode("utf-8", errors="replace")

        accessory_boxes = {
            "necklace": (0.005, 0.172, 0.365, 0.216),
            "ring": (0.300, 0.172, 0.700, 0.216),
            "bracelet": (0.600, 0.172, 0.995, 0.216),
            "gloves": (0.005, 0.210, 0.365, 0.254),
            "boots": (0.300, 0.210, 0.700, 0.254),
            "mask": (0.600, 0.210, 0.995, 0.254),
            "hat": (0.005, 0.247, 0.365, 0.292),
        }
        for slot, (left, top, right, bottom) in accessory_boxes.items():
            crop = image.crop((
                int(image.width * left), int(image.height * top),
                int(image.width * right), int(image.height * bottom),
            ))
            crop = crop.resize((crop.width * 4, crop.height * 4), Image.Resampling.LANCZOS)
            crop_output = io.BytesIO()
            crop.save(crop_output, format="PNG")
            readings = []
            for psm in ("11", "6"):
                crop_result = subprocess.run(
                    ["tesseract", "stdin", "stdout", "-l", "fra", "--psm", psm],
                    input=crop_output.getvalue(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, check=False,
                )
                reading = crop_result.stdout.decode("utf-8", errors="replace").strip()
                if reading and reading not in readings:
                    readings.append(reading)
            regions["accessories"][slot] = "\n".join(readings)
    except Exception:
        header_numbers = []
        identity_texts = []
    return {
        "text": text,
        "lines": [line.strip() for line in text.splitlines() if line.strip()],
        "header_numbers": header_numbers,
        "header_text": header_text,
        "identity_texts": identity_texts,
        "regions": regions,
    }


@router.get("/partner-specialists/{vnum}")
def partner_specialist(vnum: int):
    bundled = PARTNER_SPECIALISTS.get(str(vnum))
    if bundled:
        return bundled
    try:
        return _partner_specialist(vnum)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Partner specialist data unavailable") from exc


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
