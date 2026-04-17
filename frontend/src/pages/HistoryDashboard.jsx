// frontend/src/pages/HistoryDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../api";

const ROLE_BADGE = {
  Principale: "Principale",
  Secondaire: "Secondaire",
  Mule: "Mule",
};

export default function HistoryDashboard() {
  const family = "PandoraHearts";

  const [snapshots, setSnapshots] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ✅ Search
  const [q, setQ] = useState("");

  // ✅ Sort state
  const [sort, setSort] = useState({ key: "period_diff", dir: "desc" });

  // Largeurs fixes pour sticky columns
  const COL_PLAYER_W = 240;
  const COL_ROLE_W = 160;

  // Ref scroll principal
  const scrollRef = useRef(null);

  // ✅ Top horizontal scrollbar refs + width tracking
  const topScrollRef = useRef(null);
  const tableRef = useRef(null);
  const [topScrollWidth, setTopScrollWidth] = useState(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    fetch(`${API_BASE}/family/${family}/snapshots`)
      .then((r) => r.json())
      .then((dates) => {
        if (!Array.isArray(dates)) return;
        setSnapshots(dates);
        if (dates.length) {
          setFromDate(dates[0]);
          setToDate(dates[dates.length - 1]);
        }
      })
      .catch(() => setSnapshots([]));
  }, []);

  useEffect(() => {
    if (!fromDate || !toDate) return;

    setLoading(true);
    setErr("");
    fetch(
      `${API_BASE}/family/${family}/history?from_date=${fromDate}&to_date=${toDate}`
    )
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            (await r.text().catch(() => "")) || `HTTP ${r.status}`
          );
        return r.json();
      })
      .then((json) => setData(json))
      .catch((e) => {
        setData(null);
        setErr(e?.message || String(e));
      })
      .finally(() => setLoading(false));
  }, [fromDate, toDate]);

  const dates = data?.dates || [];
  const players = data?.players || [];

  // ✅ Helpers sort
  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      const isText = key === "nickname" || key === "role";
      return { key, dir: isText ? "asc" : "desc" };
    });
  };

  const sortIndicator = (key) => {
    if (sort.key !== key) return null;
    return sort.dir === "asc" ? " ▲" : " ▼";
  };

  // ✅ Filter + Sort
  const visiblePlayers = useMemo(() => {
    const arr = Array.isArray(players) ? [...players] : [];

    const needle = q.trim().toLowerCase();
    const filtered = !needle
      ? arr
      : arr.filter((p) => {
          const role = String(p.role || "Principale");
          const mainNick = String(p.main_nickname || "");
          const nick = String(p.nickname || "");
          return (
            nick.toLowerCase().includes(needle) ||
            role.toLowerCase().includes(needle) ||
            mainNick.toLowerCase().includes(needle)
          );
        });

    const dirMul = sort.dir === "asc" ? 1 : -1;

    const getVal = (p) => {
      if (sort.key === "nickname") return String(p.nickname || "");
      if (sort.key === "role") return String(p.role || "Principale");
      if (sort.key === "period_diff") return Number(p.period_diff ?? 0);
      if (sort.key === "weekly_diff") return Number(p.weekly_diff ?? 0);
      if (sort.key === "monthly_diff") return Number(p.monthly_diff ?? 0);

      if (sort.key.startsWith("date:")) {
        const d = sort.key.slice("date:".length);
        return Number(p.points?.[d] ?? 0);
      }

      return Number(p.period_diff ?? 0);
    };

    filtered.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);

      if (typeof va === "string" || typeof vb === "string") {
        const sa = String(va);
        const sb = String(vb);
        return sa.localeCompare(sb, "fr", { sensitivity: "base" }) * dirMul;
      }

      return (va - vb) * dirMul;
    });

    return filtered;
  }, [players, q, sort]);

  const resetControls = () => {
    setQ("");
    setSort({ key: "period_diff", dir: "desc" });
  };

  // ✅ Sync top scrollbar <-> main scrollbar
  const onMainScroll = (e) => {
    const el = e.currentTarget;
    const topEl = topScrollRef.current;
    if (!topEl) return;

    if (syncingRef.current) return;
    syncingRef.current = true;
    topEl.scrollLeft = el.scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  const onTopScroll = (e) => {
    const el = e.currentTarget;
    const mainEl = scrollRef.current;
    if (!mainEl) return;

    if (syncingRef.current) return;
    syncingRef.current = true;
    mainEl.scrollLeft = el.scrollLeft;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  // ✅ Track table width for the top scrollbar (so it matches horizontal content)
  useEffect(() => {
    if (!tableRef.current) return;

    const update = () => {
      const w = tableRef.current?.scrollWidth || 0;
      setTopScrollWidth(w);
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(tableRef.current);

    // in case fonts load / layout changes
    const t = setTimeout(update, 0);

    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [loading, data, dates.length, visiblePlayers.length]);

  // ✅ Auto-scroll à droite quand les données arrivent / changent
  useEffect(() => {
    if (loading) return;
    if (!data) return;

    const mainEl = scrollRef.current;
    if (!mainEl) return;

    const raf = requestAnimationFrame(() => {
      const right = Math.max(0, mainEl.scrollWidth - mainEl.clientWidth);
      mainEl.scrollLeft = right;
    });

    return () => cancelAnimationFrame(raf);
  }, [loading, data, dates.length, visiblePlayers.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="pointer-events-none fixed -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <header className="rounded-2xl border border-slate-700/60 bg-slate-950 p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                <span className="text-purple-300">✦</span>
                Historique
              </div>
              <h1 className="mt-3 text-2xl md:text-3xl font-extrabold tracking-tight">
                PandoraHearts • Historique
              </h1>
              <p className="mt-2 text-slate-400">Recap</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-xs uppercase text-slate-500 tracking-wider">
                Période
              </div>
              <div className="mt-3 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-slate-400">Du</label>
                  <select
                    className="mt-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
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
                    className="mt-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
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

              {data?.players?.[0]?.monthly_ref ? (
                <div className="mt-2 text-xs text-slate-500">
                  Mensuel = ref{" "}
                  <span className="text-slate-300">
                    {data.players[0].monthly_ref}
                  </span>{" "}
                  (4 semaines, dimanche si possible)
                </div>
              ) : null}
            </div>
          </div>

          {/* ✅ Search bar + actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs text-slate-400">Recherche</label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pseudo, rôle, principal…"
                className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <div className="mt-1 text-xs text-slate-500">
                {visiblePlayers.length} joueur(s) affiché(s)
              </div>
            </div>

            <button
              type="button"
              onClick={resetControls}
              className="h-[42px] mt-[18px] rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-slate-200 hover:bg-slate-950"
              title="Réinitialiser recherche + tri"
            >
              Reset
            </button>
          </div>

          {err ? <div className="mt-4 text-sm text-red-300">❌ {err}</div> : null}
        </header>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-950 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-bold text-slate-100">Tableau</h2>
            <p className="text-sm text-slate-400">Recap</p>
          </div>

          <div className="p-0">
            {loading ? (
              <div className="p-6 text-slate-400">Chargement…</div>
            ) : !data ? (
              <div className="p-6 text-slate-400">Pas de données.</div>
            ) : (
              <>
                {/* Main table scroller */}
                <div
                  ref={scrollRef}
                  onScroll={onMainScroll}
                  className="relative overflow-auto max-h-[72vh]"
                >
                  <table
                    ref={tableRef}
                    className="min-w-max w-full border-separate border-spacing-0"
                  >
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-300">
                        <th
                          className="sticky top-0 left-0 z-30 bg-slate-950 border-b border-slate-800 px-4 py-3 cursor-pointer select-none hover:text-slate-100"
                          style={{ width: COL_PLAYER_W, minWidth: COL_PLAYER_W }}
                          onClick={() => toggleSort("nickname")}
                          title="Trier"
                        >
                          Joueur{sortIndicator("nickname")}
                        </th>

                        <th
                          className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800 px-4 py-3 cursor-pointer select-none hover:text-slate-100"
                          style={{
                            left: COL_PLAYER_W,
                            width: COL_ROLE_W,
                            minWidth: COL_ROLE_W,
                            position: "sticky",
                          }}
                          onClick={() => toggleSort("role")}
                          title="Trier"
                        >
                          Rôle{sortIndicator("role")}
                        </th>

                        {dates.map((d) => (
                          <th
                            key={d}
                            className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right font-mono cursor-pointer select-none hover:text-slate-100"
                            onClick={() => toggleSort(`date:${d}`)}
                            title="Trier"
                          >
                            {d}
                            {sortIndicator(`date:${d}`)}
                          </th>
                        ))}

                        <th
                          className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right cursor-pointer select-none hover:text-slate-100"
                          onClick={() => toggleSort("period_diff")}
                          title="Trier"
                        >
                          Δ Période{sortIndicator("period_diff")}
                        </th>
                        <th
                          className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right cursor-pointer select-none hover:text-slate-100"
                          onClick={() => toggleSort("weekly_diff")}
                          title="Trier"
                        >
                          Δ Hebdo{sortIndicator("weekly_diff")}
                        </th>
                        <th
                          className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 text-right cursor-pointer select-none hover:text-slate-100"
                          onClick={() => toggleSort("monthly_diff")}
                          title="Trier"
                        >
                          Δ Mensuel (4 semaines){sortIndicator("monthly_diff")}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {visiblePlayers.map((p) => {
                        const role = p.role || "Principale";
                        const mainNick = p.main_nickname || null;

                        return (
                          <tr
                            key={p.player_id}
                            className="border-b border-slate-900/60"
                          >
                            <td
                              className="sticky left-0 z-10 bg-slate-950 border-b border-slate-900/60 px-4 py-3"
                              style={{
                                width: COL_PLAYER_W,
                                minWidth: COL_PLAYER_W,
                              }}
                            >
                              <Link
                                to={`/player/${encodeURIComponent(p.nickname)}`}
                                className="inline-flex items-center gap-2 font-semibold text-slate-100 hover:text-purple-300 hover:underline"
                              >
                                <StatusDot status={p.status} />
                                {p.nickname}
                              </Link>
                            </td>

                            <td
                              className="z-10 bg-slate-950 border-b border-slate-900/60 px-4 py-3"
                              style={{
                                left: COL_PLAYER_W,
                                width: COL_ROLE_W,
                                minWidth: COL_ROLE_W,
                                position: "sticky",
                              }}
                            >
                              <RolePill role={role} />

                              {(role === "Secondaire" || role === "Mule") &&
                              mainNick ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  →{" "}
                                  <Link
                                    to={`/player/${encodeURIComponent(mainNick)}`}
                                    className="hover:text-purple-300 hover:underline"
                                    title="Voir le principal"
                                  >
                                    {mainNick}
                                  </Link>
                                </div>
                              ) : null}
                            </td>

                            {dates.map((d) => (
                              <td
                                key={`${p.player_id}-${d}`}
                                className="border-b border-slate-900/60 px-4 py-3 text-right font-mono"
                              >
                                {(Number(p.points?.[d] || 0)).toLocaleString()}
                              </td>
                            ))}

                            <td className="border-b border-slate-900/60 px-4 py-3 text-right font-mono">
                              <DiffValue v={p.period_diff} />
                            </td>

                            <td className="border-b border-slate-900/60 px-4 py-3 text-right font-mono">
                              <DiffValue v={p.weekly_diff} />
                            </td>

                            <td className="border-b border-slate-900/60 px-4 py-3 text-right font-mono">
                              <DiffValue v={p.monthly_diff} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- UI helpers ---------------- */

function RolePill({ role }) {
  const shown = ROLE_BADGE[role] || role || "Principale";

  const base =
    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold";
  let cls = "border-slate-700 bg-slate-950 text-slate-200";

  if (shown === "Principale")
    cls = "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (shown === "Secondaire")
    cls = "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  if (shown === "Mule")
    cls = "border-purple-400/30 bg-purple-400/10 text-purple-200";

  return <span className={`${base} ${cls}`}>{shown}</span>;
}

function DiffValue({ v }) {
  if (v === null || v === undefined)
    return <span className="text-slate-500">—</span>;
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  const color =
    n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-slate-300";
  return <span className={color}>{`${sign}${n.toLocaleString()}`}</span>;
}

function StatusDot({ status }) {
  const raw = String(status ?? "").trim();
  const s = raw.toLowerCase();

  // défaut si status vide/unknown
  let cls = "bg-slate-500/70";
  let title = raw || "Inconnu";

  // backend: "actif" | "absent" | "arret_sans_nouvelle"
  // tolère aussi "arret"/"arrêt" si jamais tu en as côté front
  if (s === "actif") {
    cls = "bg-emerald-400";
    title = "Actif";
  } else if (s === "absent") {
    cls = "bg-orange-400";
    title = "Absent";
  } else if (s === "arret_sans_nouvelle" || s === "arret" || s === "arrêt") {
    cls = "bg-red-400";
    title = "Arret";
  }

  return (
    <span
      title={title}
      className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ring-slate-950 ${cls}`}
    />
  );
}