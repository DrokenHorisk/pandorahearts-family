#!/usr/bin/env python3
"""
Generate a SQL seed file for PandoraHearts from the Excel export.

Usage:
  python seed_from_excel.py "Activité fafa.xlsx" seed_pandorahearts.sql

Notes:
- The "Points d'action dd/mm/yyyy" columns are treated as CUMULATIVE totals (not deltas).
- Missing values are skipped (history endpoint will treat them as 0).
- Members are upserted on (player_id).
- weekly_points are upserted on uq_snapshot_player (snapshot_date, family, player_id).
"""
from __future__ import annotations

import sys, re
from datetime import date, datetime, time as dtime
from typing import Optional, Dict, List, Tuple

import pandas as pd
import numpy as np


FAMILY = "PandoraHearts"

# Adjust if your class ids differ
CLASS_MAP: Dict[str, int] = {
    "Archer": 1,
    "Escrimeur": 2,
    "Mage": 3,
    "Artiste Martial": 4,
    "Aventurier": 5,
}


def parse_date_from_header(h: str) -> Optional[date]:
    m = re.search(r"(\d{2})/(\d{2})/(\d{4})", str(h))
    if not m:
        return None
    return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))


def parse_level(val) -> int:
    if pd.isna(val):
        return 0
    m = re.search(r"(\d+)", str(val))
    return int(m.group(1)) if m else 0


def parse_points(x) -> Optional[int]:
    if pd.isna(x):
        return None
    if isinstance(x, (int, np.integer)):
        return int(x)
    if isinstance(x, (float, np.floating)):
        return int(round(x))
    s = str(x).strip()
    if s == "" or s.lower() == "nan":
        return None
    s = s.replace("\u202f", "").replace("\xa0", "").replace(" ", "").replace(",", "")
    s = re.sub(r"[^\d\-]", "", s)
    if s == "" or s == "-":
        return None
    return int(s)


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python seed_from_excel.py <input.xlsx> <output.sql>", file=sys.stderr)
        return 2

    xlsx_path = sys.argv[1]
    out_path = sys.argv[2]

    df = pd.read_excel(xlsx_path)

    points_cols = [c for c in df.columns if isinstance(c, str) and "Points" in c]
    dates = [parse_date_from_header(c) for c in points_cols]
    if any(d is None for d in dates):
        bad = [points_cols[i] for i, d in enumerate(dates) if d is None]
        raise SystemExit(f"Could not parse date from headers: {bad}")

    # Members
    members = df[["Player_id", "Pseudos", "Niveaux", "Classes"]].copy()
    members["player_id"] = pd.to_numeric(members["Player_id"], errors="coerce")
    members = members.dropna(subset=["player_id"])
    members["player_id"] = members["player_id"].astype(int)
    members["account_id"] = members["player_id"]  # placeholder (required not null)
    members["nickname"] = members["Pseudos"].fillna("").astype(str)
    members["level"] = members["Niveaux"].apply(parse_level)
    members["class_name"] = members["Classes"].fillna("").astype(str).str.strip()
    members["class_id"] = members["class_name"].map(CLASS_MAP).fillna(0).astype(int)

    # Weekly points
    records: List[Tuple[date, int, int]] = []
    for _, row in df.iterrows():
        pid = pd.to_numeric(row.get("Player_id"), errors="coerce")
        if pd.isna(pid):
            continue
        pid = int(pid)

        for col, d in zip(points_cols, dates):
            pts = parse_points(row.get(col))
            if pts is None or pts == 0:
                continue
            records.append((d, pid, pts))

    lines: List[str] = []
    lines.append("-- Seed data generated from Excel")
    lines.append("BEGIN;")
    lines.append("SET TIME ZONE 'UTC';")

    lines.append("-- Members")
    for _, m in members.iterrows():
        pid = int(m["player_id"])
        account = int(m["account_id"])
        nick = sql_escape(str(m["nickname"]))
        level = int(m["level"]) if not pd.isna(m["level"]) else 0
        class_id = int(m["class_id"])
        lines.append(
            "INSERT INTO members (player_id, account_id, nickname, level, class_id, family) "
            f"VALUES ({pid}, {account}, '{nick}', {level}, {class_id}, '{FAMILY}') "
            "ON CONFLICT (player_id) DO UPDATE SET "
            "account_id=EXCLUDED.account_id, nickname=EXCLUDED.nickname, level=EXCLUDED.level, "
            "class_id=EXCLUDED.class_id, family=EXCLUDED.family;"
        )

    lines.append("-- Weekly points (cumulative totals)")
    for d, pid, pts in records:
        imported_at = datetime.combine(d, dtime(12, 0, 0))  # noon UTC
        lines.append(
            "INSERT INTO weekly_points (snapshot_date, imported_at, family, player_id, gexp_points) "
            f"VALUES ('{d.isoformat()}', '{imported_at.isoformat(sep=' ')}', '{FAMILY}', {pid}, {pts}) "
            "ON CONFLICT ON CONSTRAINT uq_snapshot_player DO UPDATE SET "
            "gexp_points=EXCLUDED.gexp_points, imported_at=EXCLUDED.imported_at;"
        )

    lines.append("COMMIT;")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Wrote {out_path} with {len(members)} members and {len(records)} point rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
