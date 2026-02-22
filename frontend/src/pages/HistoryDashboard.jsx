// frontend/src/pages/HistoryDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";
import { CLASS_NAMES, CLASS_ICONS } from "../constants/classes";
import { Link } from "react-router-dom";

export default function HistoryDashboard() {
  const family = "PandoraHearts";

  const [snapshots, setSnapshots] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // ✅ Filters like Dashboard
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  // Load available snapshot dates
  useEffect(() => {
    fetch(`${API_BASE}/family/${family}/snapshots`)
      .then((r) => r.json())
      .then((dates) => {
        if (!Array.isArray(dates)) {
          console.error("Snapshots API returned:", dates);
          setSnapshots([]);
          return;
        }
        setSnapshots(dates);

        if (dates.length >= 1) {
          setFromDate(dates[0]);
          setToDate(dates[dates.length - 1]);
        }
      })
      .catch((e) => {
        console.error("Snapshots fetch error:", e);
        setSnapshots([]);
      });
  }, []);

  // Load history for date range
  useEffect(() => {
    if (!fromDate || !toDate) return;

    setLoading(true);
    fetch(
      `${API_BASE}/family/${family}/history?from_date=${fromDate}&to_date=${toDate}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (!json || !Array.isArray(json.players) || !Array.isArray(json.dates)) {
          console.error("History API error:", json);
          setData(null);
          return;
        }
        setData(json);
      })
      .catch((e) => {
        console.error("History fetch error:", e);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  // ✅ filtered players (pseudo + classe)
  const filteredPlayers = useMemo(() => {
    if (!data?.players) return [];
    const q = query.trim().toLowerCase();

    return data.players
      .filter((p) => {
        const okQ = !q || (p.nickname || "").toLowerCase().includes(q);
        const okC = classFilter === "all" || String(p.class_id) === classFilter;
        return okQ && okC;
      })
      // tri par "final" décroissant
      .sort((a, b) => Number(b.last_value || 0) - Number(a.last_value || 0));
  }, [data, query, classFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Glow orbs */}
      <div className="pointer-events-none fixed -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Header */}
        <header className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-6 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute -top-24 left-10 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="absolute -bottom-24 right-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          </div>

          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
                <span className="text-purple-300">✦</span>
                Nostale • Historique Famille
              </div>

              <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight">
                <span className="text-slate-100">Pandora</span>
                <span className="text-purple-400">Hearts</span>
              </h1>

              <p className="mt-2 text-slate-400 max-w-2xl">
                Les valeurs importées sont des <span className="text-slate-200">totaux cumulés</span>.
                On affiche donc la valeur finale et les variations (Δ) sur la période.
              </p>
            </div>
          </div>
        </header>

        {/* Panel */}
        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Historique</h2>
              <p className="text-sm text-slate-400">
                Filtre une période, recherche un pseudo, filtre une classe
              </p>
            </div>

            {/* ✅ Like dashboard: search + class */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full lg:w-auto">
              <input
                className="w-full sm:w-64 rounded-xl bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                placeholder="Rechercher un pseudo…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <select
                className="rounded-xl bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="all">Toutes classes</option>
                <option value="1">{CLASS_NAMES?.[1] || "Classe 1"}</option>
                <option value="2">{CLASS_NAMES?.[2] || "Classe 2"}</option>
                <option value="3">{CLASS_NAMES?.[3] || "Classe 3"}</option>
                <option value="4">{CLASS_NAMES?.[4] || "Classe 4"}</option>
              </select>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Dates */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-400">Du</label>
                <select
                  className="mt-1 rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={snapshots.length === 0}
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
                  disabled={snapshots.length === 0}
                >
                  {snapshots.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {snapshots.length === 0 ? (
                <div className="text-sm text-slate-500">Aucun date disponible</div>
              ) : null}
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-slate-400">Chargement…</div>
            ) : !data ? (
              <div className="text-slate-400">
                Pas de données pour cette période (ou erreur API). Vérifie la console navigateur.
              </div>
            ) : (
              <HistoryTable dates={data.dates} players={filteredPlayers} />
            )}
          </div>
        </section>

        <footer className="text-center text-xs text-slate-500">
          Thème “fantasy” inspiré de l’univers Nostale • Version dev
        </footer>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function HistoryTable({ dates, players }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
            <th
                className="
                    sticky left-0 z-30
                    bg-slate-950
                    px-3
                "
                >
                Joueur
                </th>
            <th className="px-3">Classe</th>
            <th className="px-3 text-center">Niveau</th>

            {dates.map((d) => (
              <th key={d} className="px-3 text-right">
                {d}
              </th>
            ))}

            <th className="px-3 text-right">Final</th>
            <th className="px-3 text-right">Δ Période</th>
            <th className="px-3 text-right">Δ Hebdo</th>
            <th className="px-3 text-right">Δ Mensuel</th>
          </tr>
        </thead>

        <tbody>
          {players.map((p, i) => (
            <tr
              key={`${p.player_id}-${i}`}
              className="group rounded-xl bg-slate-950/40 border border-slate-800"
            >
              <td
                className="
                    sticky left-0 z-20
                    bg-slate-950/95 backdrop-blur
                    px-3 py-3 min-w-[180px]
                    border-r border-slate-800
                "
                >
                <Link
                    to={`/player/${encodeURIComponent(p.nickname)}`}
                    className="font-semibold text-slate-100 hover:text-purple-300 transition"
                >
                    {p.nickname}
                </Link>
                </td>

              <td className="px-3 py-3">
                <ClassCell classId={p.class_id} />
              </td>

              <td className="px-3 py-3 text-center">
                <span className="text-sm text-slate-200 font-semibold">{p.level}</span>
              </td>

              {dates.map((d) => (
                <td key={d} className="px-3 py-3 text-right">
                  <span className="text-sm font-mono font-bold text-slate-100">
                    {Number(p.points?.[d] ?? 0).toLocaleString()}
                  </span>
                </td>
              ))}

              <td className="px-3 py-3 text-right">
                <span className="text-sm font-mono font-bold text-slate-100">
                  {Number(p.last_value ?? 0).toLocaleString()}
                </span>
              </td>

              <DiffCell value={p.period_diff} />
              <DiffCell value={p.weekly_diff} />
              <DiffCell
                value={p.monthly_diff}
                title={p.monthly_ref ? `Réf: ${p.monthly_ref}` : undefined}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassCell({ classId }) {
  const name = CLASS_NAMES?.[classId] || `Classe ${classId}`;
  const iconSrc = CLASS_ICONS?.[classId];

  const colorMap = {
    1: "bg-blue-500/15 text-blue-200 border-blue-500/30",
    2: "bg-red-500/15 text-red-200 border-red-500/30",
    3: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    4: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        colorMap[classId] || "bg-slate-500/10 text-slate-200 border-slate-600/30"
      }`}
      title={name}
    >
      {iconSrc ? (
        <img src={iconSrc} alt={name} className="h-5 w-5" loading="lazy" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      )}
      <span>{name}</span>
    </span>
  );
}

function DiffCell({ value, title }) {
  if (value === null || value === undefined) {
    return (
      <td className="px-3 py-3 text-right text-slate-500" title={title}>
        —
      </td>
    );
  }

  const color =
    value > 0 ? "text-emerald-400" : value < 0 ? "text-red-400" : "text-slate-400";

  const sign = value > 0 ? "+" : "";

  return (
    <td className={`px-3 py-3 text-right font-mono ${color}`} title={title}>
      {sign}
      {Number(value).toLocaleString()}
    </td>
  );
}