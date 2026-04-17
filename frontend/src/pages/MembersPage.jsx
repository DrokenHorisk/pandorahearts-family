// frontend/src/pages/Members.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../api";
import { CLASS_NAMES, CLASS_ICONS } from "../constants/classes";
import { getToken, getUser, isAllowed } from "../auth";

const FAMILY = "PandoraHearts";

const ROLE_ORDER = { Principale: 0, Secondaire: 1, Mule: 2 };
const ROLE_LABELS = { Principale: "Principale", Secondaire: "Secondaire", Mule: "Mule" };

// ✅ Fenêtres 4 semaines fixes (28 jours) ancrées
const ANCHOR_START = "2026-01-25"; // inclus
const WINDOW_DAYS = 28;

function parseYMD(s) {
  const [y, m, d] = String(s).split("-").map((x) => Number(x));
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}
function fmtYMD(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDays(dt, days) {
  const x = new Date(dt.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function compute4wWindow(latestSnapshotYMD) {
  // Fenêtre [start, start+27] qui contient latestSnapshot,
  // basée sur un ancrage 2026-01-25.
  const anchor = parseYMD(ANCHOR_START);
  const latest = parseYMD(latestSnapshotYMD);

  const diffMs = latest.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (24 * 3600 * 1000));

  let k = Math.floor(diffDays / WINDOW_DAYS);
  if (k < 0) k = 0;

  let start = addDays(anchor, k * WINDOW_DAYS);
  let end = addDays(start, WINDOW_DAYS - 1);

  if (latest.getTime() < start.getTime()) {
    start = anchor;
    end = addDays(start, WINDOW_DAYS - 1);
  }

  return { from_date: fmtYMD(start), to_date: fmtYMD(end) };
}

// ✅ Couleurs demandées (hex)
const DIFF_COLORS = {
  green: "#00c126",      // VERT
  yellowGreen: "#aeea00",// JAUNE-VERT
  yellow: "#ffc800",     // JAUNE
  orange: "#fa7300",     // ORANGE
  red: "#ff0000",        // ROUGE
};

// ✅ HEBDO: juste rouge/vert selon seuil 200k
function weeklyColor(v) {
  if (v === null || v === undefined) return { className: "text-slate-500", style: undefined };
  const n = Number(v);
  if (!Number.isFinite(n)) return { className: "text-slate-500", style: undefined };
  if (n >= 200000) return { className: "", style: { color: DIFF_COLORS.green } };
  return { className: "", style: { color: DIFF_COLORS.red } };
}

// Convertit la diff mensuelle en "points" 0..800 si besoin
// - si valeur déjà petite (ex: 350) => inchangé
// - si valeur grande (ex: 350000) => ÷1000 => 350
function toPoints(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

// ✅ 4 semaines: paliers 0-200 / 200-400 / 400-600 / 600-800 / 800+
function monthlyColor(v) {
  if (v === null || v === undefined) return { className: "text-slate-500", style: undefined };

  const pts = toPoints(v);
  if (pts === null) return { className: "text-slate-500", style: undefined };

  if (pts >= 800000) return { className: "text-cyan-300", style: undefined }; 
  if (pts >= 600000) return { className: "", style: { color: DIFF_COLORS.yellowGreen } };
  if (pts >= 400000) return { className: "", style: { color: DIFF_COLORS.yellow } };
  if (pts >= 200000) return { className: "", style: { color: DIFF_COLORS.orange } };
  return { className: "", style: { color: DIFF_COLORS.red } };
}

function statusBadge(status) {
  if (!status) return { label: "—", cls: "border-slate-700 bg-slate-950/40 text-slate-300" };
  if (status === "actif") return { label: "Actif", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" };
  if (status === "absent") return { label: "Absent", cls: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200" };
  if (status === "arret_sans_nouvelle")
    return { label: "Arrêt (sans nouvelle)", cls: "border-red-400/30 bg-red-400/10 text-red-200" };
  return { label: String(status), cls: "border-slate-700 bg-slate-950/40 text-slate-300" };
}

function normalizeRole(role) {
  return role === "Secondaire" || role === "Mule" || role === "Principale" ? role : "Principale";
}

function DiffCell({ value, className }) {
  if (value === null || value === undefined) return <span className="text-slate-500">—</span>;
  const n = Number(value);
  const sign = n > 0 ? "+" : "";
  return <span className={className}>{`${sign}${n.toLocaleString()}`}</span>;
}

export default function Members() {
  const user = getUser();
  const canEdit = isAllowed(user);

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({ from_date: "—", to_date: "—" });

  const [rows, setRows] = useState([]); // players from /history
  const [mains, setMains] = useState([]);

  // UI
  const [err, setErr] = useState("");

  // ✅ recherche + tri
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "role", dir: "asc" });

  // édition
  const [editingId, setEditingId] = useState(null);
  const [editNick, setEditNick] = useState("");
  const [editStatus, setEditStatus] = useState(null);
  const [editRole, setEditRole] = useState("Principale");
  const [editMainId, setEditMainId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  // 1) snapshots -> compute fixed 4w -> fetch history
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const r = await fetch(`${API_BASE}/family/${encodeURIComponent(FAMILY)}/snapshots`);
        const dates = await r.json();

        if (!Array.isArray(dates) || dates.length === 0) {
          if (!cancelled) {
            setRows([]);
            setPeriod({ from_date: "—", to_date: "—" });
          }
          return;
        }

        const sorted = [...dates].sort();
        const latest = sorted[sorted.length - 1];
        const p = compute4wWindow(latest);

        if (!cancelled) setPeriod(p);

        const histRes = await fetch(
          `${API_BASE}/family/${encodeURIComponent(FAMILY)}/history?from_date=${p.from_date}&to_date=${p.to_date}`
        );
        const hist = await histRes.json();

        if (!hist || !Array.isArray(hist.players)) {
          throw new Error("History API payload invalide");
        }

        if (!cancelled) setRows(hist.players);
      } catch (e) {
        if (!cancelled) {
          setErr(String(e?.message || e));
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // mains dropdown (admin)
  useEffect(() => {
    if (!canEdit) return;
    fetch(`${API_BASE}/family/${encodeURIComponent(FAMILY)}/mains`)
      .then((r) => r.json())
      .then((arr) => setMains(Array.isArray(arr) ? arr : []))
      .catch(() => setMains([]));
  }, [canEdit]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      const isText = ["nickname", "status"].includes(key);
      return { key, dir: isText ? "asc" : "desc" };
    });
  };

  const sortIndicator = (key) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  const visibleRows = useMemo(() => {
    const arr = Array.isArray(rows) ? [...rows] : [];
    const needle = q.trim().toLowerCase();

    const filtered = !needle
      ? arr
      : arr.filter((m) => {
          const nick = String(m.nickname || "").toLowerCase();
          const role = String(normalizeRole(m.role)).toLowerCase();
          const main = String(m.main_nickname || "").toLowerCase();
          const status = String(m.status || "").toLowerCase();
          return nick.includes(needle) || role.includes(needle) || main.includes(needle) || status.includes(needle);
        });

    const roleOrder = (m) => ROLE_ORDER[normalizeRole(m.role)] ?? 9;
    const dirMul = sort.dir === "asc" ? 1 : -1;

    const getVal = (m) => {
      if (sort.key === "nickname") return String(m.nickname || "");
      if (sort.key === "status") return String(m.status || "");
      if (sort.key === "role") return roleOrder(m);
      if (sort.key === "last_value") return Number(m.last_value ?? 0);
      if (sort.key === "weekly_diff") return m.weekly_diff === null || m.weekly_diff === undefined ? -1e18 : Number(m.weekly_diff);
      if (sort.key === "period_diff") return m.period_diff === null || m.period_diff === undefined ? -1e18 : Number(m.period_diff);
      if (sort.key === "monthly_diff") return m.monthly_diff === null || m.monthly_diff === undefined ? -1e18 : Number(m.monthly_diff);

      return String(m.nickname || "");
    };

    filtered.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);

      // ✅ met toujours les valeurs "null-like" à la fin
      const aNull = va === -1e18;
      const bNull = vb === -1e18;
      if (aNull && !bNull) return 1;
      if (!aNull && bNull) return -1;

      if (typeof va === "string" || typeof vb === "string") {
        return String(va).localeCompare(String(vb), "fr", { sensitivity: "base" }) * dirMul;
      }
      return (va - vb) * dirMul;
    });

    return filtered;
  }, [rows, q, sort]);

  function startEdit(m) {
    if (!canEdit) return;
    setSaveMsg("");
    setEditingId(Number(m.player_id));
    setEditNick(m.nickname || "");
    setEditStatus(m.status ?? null);
    const r = normalizeRole(m.role);
    setEditRole(r);
    setEditMainId(m.main_player_id ? String(m.main_player_id) : "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditNick("");
    setEditStatus(null);
    setEditRole("Principale");
    setEditMainId("");
    setSaveMsg("");
  }

  async function saveEdit(m) {
    if (!canEdit) return;
    const pid = Number(m.player_id);
    if (!pid) return;

    setSaving(true);
    setSaveMsg("");

    try {
      const token = getToken();
      if (!token) throw new Error("Pas connecté");

      const nextNick = String(editNick || "").trim();
      if (!nextNick) throw new Error("Pseudo vide");

      // 1) nickname
      if (nextNick !== String(m.nickname || "")) {
        const resNick = await fetch(`${API_BASE}/family/${encodeURIComponent(FAMILY)}/player/${pid}/nickname`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nickname: nextNick }),
        });
        if (!resNick.ok) throw new Error((await resNick.text().catch(() => "")) || `HTTP ${resNick.status}`);
      }

      // 2) status (nullable) — nécessite l'endpoint backend
      const resStatus = await fetch(`${API_BASE}/family/${encodeURIComponent(FAMILY)}/player/${pid}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: editStatus ?? null }),
      });
      if (!resStatus.ok) throw new Error((await resStatus.text().catch(() => "")) || `HTTP ${resStatus.status}`);

      // 3) role + link
      const role = normalizeRole(editRole);
      const needsMain = role === "Secondaire" || role === "Mule";
      const main_player_id = role === "Principale" ? null : editMainId ? Number(editMainId) : null;
      if (needsMain && !main_player_id) throw new Error("Secondaire/Mule => choisir un principal (main_player_id)");

      const resRole = await fetch(`${API_BASE}/family/${encodeURIComponent(FAMILY)}/player/${pid}/role-link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role, main_player_id }),
      });
      if (!resRole.ok) throw new Error((await resRole.text().catch(() => "")) || `HTTP ${resRole.status}`);

      // refresh list
      const histRes = await fetch(
        `${API_BASE}/family/${encodeURIComponent(FAMILY)}/history?from_date=${period.from_date}&to_date=${period.to_date}`
      );
      const hist = await histRes.json();
      if (hist?.players) setRows(hist.players);

      setSaveMsg("✅ Modifs enregistrées");
      setEditingId(null);
    } catch (e) {
      setSaveMsg(`❌ ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  const resetControls = () => {
    setQ("");
    setSort({ key: "role", dir: "asc" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none fixed -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            to="/"
            className="text-sm text-slate-300 hover:text-purple-300 underline decoration-slate-700 hover:decoration-purple-400"
          >
            ← Retour à l’accueil
          </Link>

          <div className="text-xs text-slate-400">
            Période (4 semaines) :{" "}
            <span className="text-slate-200 font-mono">
              {period.from_date} → {period.to_date}
            </span>
          </div>
        </div>

        <header className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
            <span className="text-purple-300">✦</span>
            Membres • PandoraHearts
          </div>

          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Liste des membres</h1>

          <p className="mt-2 text-slate-400">
            Ordre : <span className="text-slate-200">Principale</span>, puis{" "}
            <span className="text-slate-200">Secondaire</span>, puis{" "}
            <span className="text-slate-200">Mule</span>.
          </p>

          {/* ✅ recherche + reset */}
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs text-slate-400">Recherche</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pseudo, rôle, principal, status…"
                className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <div className="mt-1 text-xs text-slate-500">{visibleRows.length} membre(s)</div>
            </div>

            <button
              type="button"
              onClick={resetControls}
              className="h-[42px] rounded-xl border border-slate-700 bg-slate-950/50 px-4 text-sm text-slate-200 hover:bg-slate-950/70"
              title="Reset recherche + tri"
            >
              Reset
            </button>
          </div>

          {err ? <div className="mt-3 text-sm text-red-200">{err}</div> : null}
        </header>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Table</h2>
              <p className="text-sm text-slate-400">Dernier total + Δ hebdo + Δ 4 semaines</p>
            </div>

            {canEdit ? <div className="text-xs text-slate-400">Mode admin : édition ligne par ligne</div> : null}
          </div>

          <div className="p-6">
            {loading ? (
              <div className="text-slate-400">Chargement…</div>
            ) : visibleRows.length === 0 ? (
              <div className="text-slate-400">Aucune donnée.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-3 cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort("nickname")}>
                        Pseudo{sortIndicator("nickname")}
                      </th>
                      <th className="px-3 cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort("status")}>
                        Info{sortIndicator("status")}
                      </th>
                      <th className="px-3 cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort("role")}>
                        Rôle{sortIndicator("role")}
                      </th>
                      <th className="px-3 text-right cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort("last_value")}>
                        Dernier GEXP{sortIndicator("last_value")}
                      </th>
                      <th className="px-3 text-right cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort("weekly_diff")}>
                        Δ Hebdo{sortIndicator("weekly_diff")}
                      </th>
                      <th className="px-3 text-right cursor-pointer select-none hover:text-slate-200" onClick={() => toggleSort("monthly_diff")}>
                        Δ 4 semaines{sortIndicator("monthly_diff")}
                      </th>
                      {canEdit ? <th className="px-3 text-right">Admin</th> : null}
                    </tr>
                  </thead>

                  <tbody>
                    {visibleRows.map((m) => {
                      const pid = Number(m.player_id);
                      const isEditing = canEdit && editingId === pid;

                      const role = normalizeRole(m.role);
                      const status = m.status ?? null;
                      const s = statusBadge(status);

                      const lastVal = Number(m.last_value ?? 0);

                      const w = m.weekly_diff === null || m.weekly_diff === undefined ? null : Number(m.weekly_diff);
                      const mo = m.monthly_diff === null || m.monthly_diff === undefined ? null : Number(m.monthly_diff);

                      const wC = weeklyColor(w);
                      const moC = monthlyColor(mo);

                      return (
                        <tr key={pid || m.nickname} className="rounded-xl bg-slate-950/40 border border-slate-800">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3 min-w-[260px]">
                              {CLASS_ICONS?.[m.class_id] ? (
                                <img
                                  src={CLASS_ICONS[m.class_id]}
                                  alt={CLASS_NAMES?.[m.class_id] || `Classe ${m.class_id}`}
                                  className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-950/50 p-1"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded-lg border border-slate-700 bg-slate-950/50 flex items-center justify-center text-[10px] text-slate-300">
                                  {m.class_id ?? "?"}
                                </div>
                              )}

                              {isEditing ? (
                                <input
                                  className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                                  value={editNick}
                                  onChange={(e) => setEditNick(e.target.value)}
                                  disabled={saving}
                                />
                              ) : (
                                <Link
                                  to={`/player/${encodeURIComponent(m.nickname || "")}`}
                                  className="font-semibold text-slate-100 hover:text-purple-300 hover:underline underline-offset-4 transition truncate"
                                  title={`Voir la fiche de ${m.nickname}`}
                                >
                                  {m.nickname || "—"}
                                </Link>
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-3">
                            {isEditing ? (
                              <select
                                className="rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
                                value={editStatus === null ? "" : editStatus}
                                onChange={(e) => setEditStatus(e.target.value ? e.target.value : null)}
                                disabled={saving}
                              >
                                <option value="">— (non défini)</option>
                                <option value="actif">actif</option>
                                <option value="absent">absent</option>
                                <option value="arret_sans_nouvelle">arret_sans_nouvelle</option>
                              </select>
                            ) : (
                              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
                                {s.label}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3">
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <select
                                  className="rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
                                  value={editRole}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setEditRole(v);
                                    if (v === "Principale") setEditMainId("");
                                  }}
                                  disabled={saving}
                                >
                                  <option value="Principale">Principale</option>
                                  <option value="Secondaire">Secondaire</option>
                                  <option value="Mule">Mule</option>
                                </select>

                                {editRole === "Secondaire" || editRole === "Mule" ? (
                                  <select
                                    className="rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                                    value={editMainId}
                                    onChange={(e) => setEditMainId(e.target.value)}
                                    disabled={saving}
                                  >
                                    <option value="">— choisir un principal —</option>
                                    {mains.map((x) => (
                                      <option key={x.player_id} value={String(x.player_id)}>
                                        {x.nickname}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm text-slate-200 font-semibold">{ROLE_LABELS[role] || role}</span>

                                {!m.main_nickname || role === "Principale" ? null : (
                                  <div className="text-xs text-slate-400">
                                    Principal :{" "}
                                    <Link
                                      to={`/player/${encodeURIComponent(m.main_nickname)}`}
                                      className="text-slate-300 hover:text-purple-300 underline decoration-slate-700 hover:decoration-purple-400"
                                    >
                                      {m.main_nickname}
                                    </Link>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-bold text-slate-100">
                            {lastVal.toLocaleString()}
                          </td>

                          <td className={`px-3 py-3 text-right font-mono ${wC.className}`} style={wC.style}>
                            <DiffCell value={w} className={wC.className} />
                          </td>

                          <td className={`px-3 py-3 text-right font-mono ${moC.className}`} style={moC.style}>
                            <DiffCell value={mo} className={moC.className} />
                          </td>

                          {canEdit ? (
                            <td className="px-3 py-3 text-right">
                              {isEditing ? (
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => saveEdit(m)}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15 disabled:opacity-40"
                                  >
                                    {saving ? "…" : "✅"}
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-950/70 disabled:opacity-40"
                                  >
                                    ✖️
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEdit(m)}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-purple-400/30 bg-purple-400/10 text-purple-200 hover:bg-purple-400/15"
                                  title="Modifier (admin)"
                                >
                                  ✏️
                                </button>
                              )}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {canEdit && saveMsg ? <div className="mt-3 text-sm text-slate-300">{saveMsg}</div> : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}