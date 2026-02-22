// frontend/src/pages/PlayerDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import { CLASS_NAMES, CLASS_ICONS } from "../constants/classes";
import EvolutionChart from "../components/EvolutionChart";
import { getToken, getUser, isAllowed } from "../auth";

export default function PlayerDashboard() {
  const family = "PandoraHearts";
  const { nickname } = useParams();
  const navigate = useNavigate();

  const [snapshots, setSnapshots] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const user = getUser();
  const canEdit = isAllowed(user);

  const [editing, setEditing] = useState(false);
  const [newNick, setNewNick] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // dates disponibles
  useEffect(() => {
    fetch(`${API_BASE}/family/${family}/snapshots`)
      .then((r) => r.json())
      .then((dates) => {
        if (!Array.isArray(dates)) return;
        setSnapshots(dates);
        if (dates.length >= 1) {
          setFromDate(dates[0]);
          setToDate(dates[dates.length - 1]);
        }
      })
      .catch(() => setSnapshots([]));
  }, []);

  // fetch détail joueur
  useEffect(() => {
    if (!nickname || !fromDate || !toDate) return;

    setLoading(true);
    fetch(
      `${API_BASE}/family/${family}/player/by-nickname/${encodeURIComponent(
        nickname
      )}?from_date=${fromDate}&to_date=${toDate}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (!json || !json.player) {
          setData(null);
          return;
        }
        setData(json);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [nickname, fromDate, toDate]);

  // init input nickname quand data change
  useEffect(() => {
    if (data?.player?.nickname) setNewNick(data.player.nickname);
  }, [data?.player?.nickname]);

  // ✅ IMPORTANT : la fonction DOIT être dans le composant
  async function saveNickname() {
    setSaving(true);
    setSaveMsg("");
    try {
      const token = getToken();
      if (!token) throw new Error("Pas connecté");

      const res = await fetch(
        `${API_BASE}/family/${family}/player/${data.player.player_id}/nickname`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nickname: newNick }),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const updated = await res.json();

      // maj locale pour affichage
      setData((prev) =>
        prev ? { ...prev, player: { ...prev.player, nickname: updated.nickname } } : prev
      );

      setEditing(false);
      setSaveMsg("✅ Pseudo mis à jour");

      // ✅ redirige vers la nouvelle URL /player/:nickname
      navigate(`/player/${encodeURIComponent(updated.nickname)}`, { replace: true });
    } catch (e) {
      setSaveMsg(`❌ ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  const points = useMemo(() => {
    if (!data?.dates?.length) return [];
    const descDates = [...data.dates].reverse();
    return descDates.map((d) => ({
      date: d,
      value: Number(data.series?.[d] ?? 0),
    }));
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none fixed -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <Link
            to="/history"
            className="text-sm text-slate-300 hover:text-purple-300 underline decoration-slate-700 hover:decoration-purple-400"
          >
            ← Retour à l’historique
          </Link>
        </div>

        <header className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-6">
          {loading || !data ? (
            <div className="text-slate-400">Chargement…</div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
                  <span className="text-purple-300">✦</span>
                  Détails Joueur
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {!editing ? (
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                        <span className="text-slate-100">{data.player.nickname}</span>
                      </h1>

                      {canEdit ? (
                        <button
                          onClick={() => {
                            setEditing(true);
                            setSaveMsg("");
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-semibold border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15"
                          title="Modifier le pseudo"
                        >
                          ✏️ Modifier
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        className="w-full sm:w-72 rounded-xl bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
                        value={newNick}
                        onChange={(e) => setNewNick(e.target.value)}
                      />

                      <button
                        onClick={saveNickname}
                        disabled={saving || !newNick.trim()}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-40"
                      >
                        {saving ? "Sauvegarde…" : "Enregistrer"}
                      </button>

                      <button
                        onClick={() => {
                          setEditing(false);
                          setNewNick(data.player.nickname);
                          setSaveMsg("");
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-slate-300 hover:text-slate-100"
                      >
                        Annuler
                      </button>
                    </div>
                  )}

                  {saveMsg ? <div className="text-sm text-slate-300">{saveMsg}</div> : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <ClassBadge classId={data.player.class_id} />
                  <span className="text-sm text-slate-300">
                    Niveau <span className="font-bold text-slate-100">{data.player.level}</span>
                  </span>
                </div>

                <p className="mt-3 text-slate-400">
                  Valeurs importées = <span className="text-slate-200">totaux cumulés</span>. Les Δ représentent des gains.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 min-w-[280px]">
                <div className="text-xs uppercase text-slate-500 tracking-wider">Période</div>

                <div className="mt-3 flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs text-slate-400">Du</label>
                    <select
                      className="mt-1 rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    >
                      {snapshots.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400">Au</label>
                    <select
                      className="mt-1 rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    >
                      {snapshots.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Stat label="Final" value={data.stats?.last_value} />
                  <Stat label="Δ Période" value={data.stats?.period_diff} diff />
                  <Stat label="Δ Hebdo" value={data.stats?.weekly_diff} diff />
                  <Stat
                    label={
                      data.stats?.monthly_ref
                        ? `Δ Mensuel (ref ${data.stats.monthly_ref})`
                        : "Δ Mensuel"
                    }
                    value={data.stats?.monthly_diff}
                    diff
                  />
                </div>
              </div>
            </div>
          )}
        </header>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100">Évolution (graphique)</h2>
            <p className="text-sm text-slate-400">
              Total cumulé et Δ entre les mises à jour sur la période sélectionnée
            </p>
          </div>

          <div className="p-6">
            {!data ? (
              <div className="text-slate-400">Pas de données.</div>
            ) : (
              <EvolutionChart dates={data.dates} series={data.series} />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100">Évolution</h2>
            <p className="text-sm text-slate-400">Mises à jour les plus recentes en haut</p>
          </div>

          <div className="p-6">
            {!data ? (
              <div className="text-slate-400">Pas de données.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                      <th className="px-3">Date</th>
                      <th className="px-3 text-right">Total</th>
                      <th className="px-3 text-right">Δ vs précédent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((row, idx) => {
                      const next = idx > 0 ? points[idx - 1].value : null; // date plus récente
                      const delta = next === null ? null : next - row.value;
                      return (
                        <tr key={row.date} className="rounded-xl bg-slate-950/40 border border-slate-800">
                          <td className="px-3 py-3 font-mono text-sm text-slate-200">{row.date}</td>
                          <td className="px-3 py-3 text-right font-mono font-bold">{row.value.toLocaleString()}</td>
                          <DiffTd value={delta} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function ClassBadge({ classId }) {
  const name = CLASS_NAMES?.[classId] || `Classe ${classId}`;
  const iconSrc = CLASS_ICONS?.[classId];

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
      {iconSrc ? <img src={iconSrc} alt={name} className="h-5 w-5" /> : null}
      <span>{name}</span>
    </span>
  );
}

function Stat({ label, value, diff = false }) {
  const n = value === null || value === undefined ? null : Number(value);
  const sign = diff && n !== null && n > 0 ? "+" : "";
  const color =
    !diff
      ? "text-slate-100"
      : n === null
      ? "text-slate-500"
      : n > 0
      ? "text-emerald-400"
      : n < 0
      ? "text-red-400"
      : "text-slate-300";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 font-mono font-bold ${color}`}>
        {n === null ? "—" : `${sign}${n.toLocaleString()}`}
      </div>
    </div>
  );
}

function DiffTd({ value }) {
  if (value === null || value === undefined) {
    return <td className="px-3 py-3 text-right text-slate-500">—</td>;
  }
  const n = Number(value);
  const color = n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-slate-300";
  const sign = n > 0 ? "+" : "";
  return (
    <td className={`px-3 py-3 text-right font-mono ${color}`}>
      {sign}
      {n.toLocaleString()}
    </td>
  );
}