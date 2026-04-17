// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";
import { CLASS_NAMES, CLASS_ICONS } from "../constants/classes";
import { Link } from "react-router-dom";

const FAMILY = "PandoraHearts";

/* ---------------- 4 weeks fixed period helpers ---------------- */

function toISODateUTC(d) {
  return d.toISOString().slice(0, 10);
}

function parseISODateUTC(s) {
  return new Date(`${s}T00:00:00Z`);
}

function addDaysUTC(dateObj, days) {
  const d = new Date(dateObj.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const PERIOD_ANCHOR = "2026-01-25"; // start0
const PERIOD_DAYS = 28;

function get4WeeksPeriodForDate(dateStr) {
  const anchor = parseISODateUTC(PERIOD_ANCHOR);
  const d = parseISODateUTC(dateStr);

  const diffDays = Math.floor(
    (d.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24)
  );
  const k = diffDays >= 0 ? Math.floor(diffDays / PERIOD_DAYS) : 0;

  const start = addDaysUTC(anchor, k * PERIOD_DAYS);
  const end = addDaysUTC(start, PERIOD_DAYS); // ex: 25/01 + 28 => 22/02

  return { startStr: toISODateUTC(start), endStr: toISODateUTC(end) };
}

function pickSnapshotAtOrBefore(sortedDates, targetStr) {
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    if (sortedDates[i] <= targetStr) return sortedDates[i];
  }
  return sortedDates[0] || null;
}

/* ---------------- Page ---------------- */

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snapshotDateShown, setSnapshotDateShown] = useState("—");
  const [monthlyPeriodShown, setMonthlyPeriodShown] = useState("");

  // Filters
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function loadMonthlyLeaderboard() {
      try {
        setLoading(true);

        // 1) snapshots
        const datesRes = await fetch(
          `${API_BASE}/family/${encodeURIComponent(FAMILY)}/snapshots`
        );
        const dates = await datesRes.json();

        if (!Array.isArray(dates) || dates.length === 0) {
          if (!cancelled) {
            setMembers([]);
            setSnapshotDateShown("—");
            setMonthlyPeriodShown("");
          }
          return;
        }

        const sorted = [...dates].sort();
        const latest = sorted[sorted.length - 1];

        // ✅ fixed 4-week period containing latest
        const { startStr, endStr } = get4WeeksPeriodForDate(latest);
        if (!cancelled) setMonthlyPeriodShown(`${startStr} → ${endStr}`);

        // ✅ pick real snapshots closest <= targets
        const toDate = pickSnapshotAtOrBefore(sorted, endStr) || latest;
        const fromDate = pickSnapshotAtOrBefore(sorted, startStr) || sorted[0];

        // 2) history for this period
        const histRes = await fetch(
          `${API_BASE}/family/${encodeURIComponent(
            FAMILY
          )}/history?from_date=${fromDate}&to_date=${toDate}`
        );
        const hist = await histRes.json();

        if (!hist || !Array.isArray(hist.players)) {
          console.error("History API invalid payload:", hist);
          if (!cancelled) {
            setMembers([]);
            setSnapshotDateShown(
              new Date(toDate).toLocaleDateString("fr-FR")
            );
          }
          return;
        }

        if (!cancelled) {
          setMembers(hist.players);
          setSnapshotDateShown(new Date(toDate).toLocaleDateString("fr-FR"));
        }
      } catch (e) {
        console.error("Monthly dashboard load error:", e);
        if (!cancelled) {
          setMembers([]);
          setSnapshotDateShown("—");
          setMonthlyPeriodShown("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMonthlyLeaderboard();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ ranked: only Principale + filters + sort
  const rankedMonthly = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (members || [])
      .filter((m) => {
        const role = String(m.role || "Principale");
        if (role !== "Principale") return false;

        const okQ = !q || (m.nickname || "").toLowerCase().includes(q);
        const okC = classFilter === "all" || String(m.class_id) === classFilter;
        return okQ && okC;
      })
      .sort((a, b) => {
        const am = Number(a.monthly_diff ?? 0);
        const bm = Number(b.monthly_diff ?? 0);
        if (bm !== am) return bm - am;

        const aw = Number(a.weekly_diff ?? 0);
        const bw = Number(b.weekly_diff ?? 0);
        if (bw !== aw) return bw - aw;

        return String(a.nickname || "").localeCompare(String(b.nickname || ""), "fr");
      });
  }, [members, query, classFilter]);

  const top1 = useMemo(() => rankedMonthly[0]?.nickname || "—", [rankedMonthly]);
  const top3 = useMemo(() => rankedMonthly.slice(0, 3), [rankedMonthly]);

  const totalPoints = useMemo(() => {
    return rankedMonthly.reduce(
      (acc, m) => acc + (Number(m.last_value ?? 0) || 0),
      0
    );
  }, [rankedMonthly]);

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
                Nostale • Dashboard Famille
              </div>

              <h1 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight">
                <span className="text-slate-100">Pandora</span>
                <span className="text-purple-400">Hearts</span>
              </h1>

              <p className="mt-2 text-slate-400 max-w-2xl">
                Classement basé sur le Δ mensuel (période fixe 4 semaines)
                {monthlyPeriodShown ? (
                  <>
                    {" "}
                    • <span className="text-slate-200">{monthlyPeriodShown}</span>
                  </>
                ) : null}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Pill tone="emerald">● Live</Pill>
              <Pill tone="cyan">PvE</Pill>
              <Pill tone="purple">Famille</Pill>
            </div>
          </div>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* ✅ clique => /members */}
          <Link to="/members" className="block">
            <StatCard
              title="Membres"
              value={members.length ? String(members.length) : "—"}
              hint={`Famille ${FAMILY} • cliquer pour la liste`}
            />
          </Link>
          <StatCard
            title="Total points (fin)"
            value={members.length ? totalPoints.toLocaleString() : "—"}
            hint="somme des valeurs finales"
          />
          <StatCard
            title="Top 1 (Δ mensuel)"
            value={members.length ? top1 : "—"}
            hint="Leader mensuel"
          />
          <StatCard
            title="Mise à jour le"
            value={members.length ? snapshotDateShown : "—"}
            hint="Dernière snapshot"
          />
        </section>

        {/* Content */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Podium */}
          <Panel
            className="lg:col-span-2"
            title="Top 3 — Podium (Δ mensuel)"
            subtitle="Les meilleurs contributeurs ce mois-ci"
          >
            {loading ? (
              <LoadingBlock />
            ) : members.length === 0 ? (
              <EmptyState />
            ) : (
              <Podium top3={top3} />
            )}
          </Panel>

          {/* Classement */}
          <Panel
            className="lg:col-span-3"
            title="Classement (Δ mensuel)"
            subtitle="Recherche et filtre"
            right={
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
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
                  <option value="1">🗡️ {CLASS_NAMES?.[1] || "Classe 1"}</option>
                  <option value="2">🏹 {CLASS_NAMES?.[2] || "Classe 2"}</option>
                  <option value="3">✨ {CLASS_NAMES?.[3] || "Classe 3"}</option>
                  <option value="4">👊 {CLASS_NAMES?.[4] || "Classe 4"}</option>
                </select>
              </div>
            }
          >
            {loading ? (
              <LoadingBlock />
            ) : members.length === 0 ? (
              <EmptyState />
            ) : (
              <MonthlyLeaderboardTable members={rankedMonthly} />
            )}
          </Panel>
        </section>

        <footer className="text-center text-xs text-slate-500">
          Dashboard de la famille PandoraHearts • Dashboard mensuel
        </footer>
      </div>
    </div>
  );
}

/* ---------- Table ---------- */

function MonthlyLeaderboardTable({ members }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-3">#</th>
            <th className="px-3">Pseudo</th>
            <th className="px-3">Classe</th>
            <th className="px-3 text-center">Niveau</th>
            <th className="px-3 text-right">Δ Mensuel</th>
          </tr>
        </thead>

        <tbody>
          {members.map((m, idx) => (
            <tr
              key={`${m.player_id || m.nickname || idx}`}
              className="group rounded-xl bg-slate-950/40 border border-slate-800"
            >
              <td className="px-3 py-3 text-slate-300 font-mono">{idx + 1}</td>

              <td className="px-3 py-3">
                <Link
                  to={`/player/${encodeURIComponent(m.nickname || "")}`}
                  className="font-semibold text-slate-100 truncate hover:text-purple-300 hover:underline underline-offset-4 transition block"
                  title={`Voir la fiche de ${m.nickname}`}
                >
                  {m.nickname || "—"}
                </Link>
              </td>

              <td className="px-3 py-3">
                <ClassPill classId={m.class_id} />
              </td>

              <td className="px-3 py-3 text-center">
                <span className="text-sm text-slate-200 font-semibold">
                  {m.level ?? "—"}
                </span>
              </td>

              <DiffTd value={m.monthly_diff} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffTd({ value }) {
  if (value === null || value === undefined) {
    return <td className="px-3 py-3 text-right text-slate-500">—</td>;
  }
  const v = Number(value) || 0;
  const color =
    v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-slate-400";
  const sign = v > 0 ? "+" : "";
  return (
    <td className={`px-3 py-3 text-right font-mono ${color}`}>
      {sign}
      {v.toLocaleString()}
    </td>
  );
}

/* ---------- UI blocks ---------- */

function Pill({ tone, children }) {
  const map = {
    emerald: "bg-emerald-600/15 text-emerald-300 border-emerald-600/30",
    cyan: "bg-cyan-500/10 text-cyan-200 border-cyan-500/30",
    purple: "bg-purple-500/10 text-purple-200 border-purple-500/30",
  };
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        map[tone] || map.purple
      }`}
    >
      {children}
    </span>
  );
}

function StatCard({ title, value, hint, to }) {
  const inner = (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-5 hover:bg-slate-950/50 transition">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
      <div className="mt-4 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full w-2/3 bg-gradient-to-r from-purple-500/60 to-cyan-400/40" />
      </div>
    </div>
  );

  if (!to) return inner;

  return (
    <Link to={to} className="block" title="Voir la liste des membres">
      {inner}
    </Link>
  );
}

function Panel({ title, subtitle, right, children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden ${className}`}
    >
      <div className="px-6 py-4 border-b border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400">{subtitle}</p>
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ---------- Podium (1 > 2 > 3, décalé, points plus petits) ---------- */

function Podium({ top3 }) {
  const [first, second, third] = top3;

  return (
    <div className="grid grid-cols-3 gap-3 items-end">
      <div className="translate-y-8">
        <PodiumCard place={2} member={second} />
      </div>

      <div className="-translate-y-2">
        <PodiumCard place={1} member={first} />
      </div>

      <div className="translate-y-12">
        <PodiumCard place={3} member={third} />
      </div>
    </div>
  );
}

function PodiumCard({ place, member }) {
  const styles = {
    1: "border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_50px_rgba(234,179,8,0.14)]",
    2: "border-slate-400/40 bg-slate-400/10",
    3: "border-amber-700/40 bg-amber-700/10",
  };

  const medal = { 1: "👑", 2: "🥈", 3: "🥉" }[place];

  const monthly = Number(member?.monthly_diff ?? 0);
  const monthlySign = monthly > 0 ? "+" : "";
  const monthlyColor =
    monthly > 0
      ? "text-emerald-300"
      : monthly < 0
      ? "text-red-300"
      : "text-slate-300";

  const size = {
    1: "min-h-[290px] p-4",
    2: "min-h-[235px] p-4",
    3: "min-h-[205px] p-4",
  }[place];

  const nameSize = { 1: "text-lg", 2: "text-base", 3: "text-sm" }[place];

  // ✅ ICI la taille du "+5 284 638" (plus petit)
  const numberSize = {
    1: "text-lg sm:text-xl",
    2: "text-base sm:text-lg",
    3: "text-sm sm:text-base",
  }[place];

  return (
    <div
      className={`rounded-2xl border text-center overflow-hidden ${styles[place]} ${size}`}
    >
      <div className="flex items-center justify-center gap-2">
        <div className={place === 1 ? "text-4xl" : "text-3xl"}>{medal}</div>
        <div className="text-xs text-slate-300 font-mono">#{place}</div>
      </div>

      {member?.nickname ? (
        <Link
          to={`/player/${encodeURIComponent(member.nickname)}`}
          className={[
            "mt-3 font-extrabold text-slate-100 truncate",
            "hover:text-purple-300 hover:underline underline-offset-4 transition block",
            nameSize,
          ].join(" ")}
          title={`Voir la fiche de ${member.nickname}`}
        >
          {member.nickname}
        </Link>
      ) : (
        <div className={`mt-3 font-extrabold text-slate-100 truncate ${nameSize}`}>
          —
        </div>
      )}

      <div
        className={[
          "mt-3 font-bold font-mono tabular-nums leading-tight whitespace-nowrap text-center",
          numberSize,
          monthlyColor,
        ].join(" ")}
      >
        {monthlySign}
        {monthly.toLocaleString()}
      </div>

      <div className="mt-1 text-xs text-slate-400">Δ mensuel</div>

      <div className="mt-5 flex justify-center">
        {member ? <ClassPill classId={member.class_id} /> : null}
      </div>

      <div className="mt-6 h-px w-full bg-slate-800/80" />
    </div>
  );
}

function ClassPill({ classId }) {
  const map = {
    1: "bg-blue-500/15 text-blue-200 border-blue-500/30",
    2: "bg-red-500/15 text-red-200 border-red-500/30",
    3: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    4: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  };
  const name = CLASS_NAMES?.[classId] || `Classe ${classId}`;
  const icon = CLASS_ICONS?.[classId];

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold inline-flex items-center gap-2 ${
        map[classId] || "bg-slate-500/10 text-slate-200 border-slate-600/30"
      }`}
      title={name}
    >
      {icon ? (
        <img src={icon} alt={name} className="h-6 w-6 object-contain" />
      ) : (
        <span>❔</span>
      )}
      <span>{name}</span>
    </span>
  );
}

function LoadingBlock() {
  return (
    <div className="space-y-3">
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine />
    </div>
  );
}

function SkeletonLine() {
  return <div className="h-10 rounded-xl bg-slate-800/80 animate-pulse" />;
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/30 p-6 text-center">
      <div className="text-2xl">📜</div>
      <div className="mt-2 font-semibold text-slate-100">Aucune donnée</div>
      <div className="mt-1 text-sm text-slate-400">
        Ya rien pour le moment voit avec Droken ou les Tetes de fafa
      </div>
    </div>
  );
}