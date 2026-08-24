import json
from datetime import datetime
from urllib.request import Request, urlopen

from sqlalchemy.dialects.postgresql import insert

from .models import GameDataEntry, GameDataSync


BASE_URL = "https://nostale-wiki.vercel.app"
SOURCES = {
    "monsters": ("monsters", "monster"),
    "items": ("items", "Item"),
    "skills": ("skills", "Skill"),
    "buffs": ("cards", "Card"),
    "effects": ("bcards", "BCard"),
}


def _download_json(path: str):
    request = Request(f"{BASE_URL}{path}", headers={"User-Agent": "PandoraHearts/1.0"})
    with urlopen(request, timeout=120) as response:
        return json.load(response)


def _translations(dataset: str):
    document = _download_json(f"/translations/FR/_code_fr_{dataset}.txt.json")
    result = {}
    for line in document.get("content", "").replace("\r", "\n").split("\n"):
        if "\t" not in line:
            continue
        key, value = line.split("\t", 1)
        result[key.strip()] = value.replace("^", " ").strip()
    return result


def _rows(kind: str, records: list, translations: dict):
    for record in records:
        vnum = record.get("Vnum")
        # NosWiki contient quelques lignes techniques VNum 0 (notamment trois
        # cartes sans identité). Elles ne représentent aucun objet du jeu et
        # ne peuvent pas partager notre clé fonctionnelle kind/VNum.
        if vnum is None or int(vnum) <= 0:
            continue
        name_code = record.get("NameCode") or ""
        yield {
            "kind": kind,
            "vnum": int(vnum),
            "name": translations.get(name_code, name_code),
            "name_code": name_code,
            "icon_id": int(record.get("IconId") or 0),
            "payload": record,
            "source_url": f"{BASE_URL}/data/{SOURCES[kind][0]}.json",
            "synced_at": datetime.utcnow(),
        }


def sync_kind(db, kind: str):
    source, translation_source = SOURCES[kind]
    records = _download_json(f"/data/{source}.json")
    translations = _translations(translation_source)
    rows = list(_rows(kind, records, translations))

    for offset in range(0, len(rows), 250):
        chunk = rows[offset:offset + 250]
        statement = insert(GameDataEntry).values(chunk)
        statement = statement.on_conflict_do_update(
            index_elements=[GameDataEntry.kind, GameDataEntry.vnum],
            set_={
                "name": statement.excluded.name,
                "name_code": statement.excluded.name_code,
                "icon_id": statement.excluded.icon_id,
                "payload": statement.excluded.payload,
                "source_url": statement.excluded.source_url,
                "synced_at": statement.excluded.synced_at,
            },
        )
        db.execute(statement)

    incoming = [row["vnum"] for row in rows]
    db.query(GameDataEntry).filter(
        GameDataEntry.kind == kind,
        ~GameDataEntry.vnum.in_(incoming),
    ).delete(synchronize_session=False)

    status = db.get(GameDataSync, kind)
    if status:
        status.count = len(rows)
        status.synced_at = datetime.utcnow()
        status.source_url = f"{BASE_URL}/data/{source}.json"
    else:
        db.add(GameDataSync(
            kind=kind,
            count=len(rows),
            synced_at=datetime.utcnow(),
            source_url=f"{BASE_URL}/data/{source}.json",
        ))
    db.commit()
    return len(rows)


def sync_all(db):
    return {kind: sync_kind(db, kind) for kind in SOURCES}
