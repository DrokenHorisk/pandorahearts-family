// frontend/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";
import Leaderboard from "../components/Leaderboard";
import { CLASS_NAMES, CLASS_ICONS } from "../constants/classes";

const FAMILY = "PandoraHearts";

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Leaderboard filters
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const loadLatest = () => {
    setLoading(true);
    fetch(`${API_BASE}/family/${encodeURIComponent(FAMILY)}/latest`)
      .then((res) => res.json())
      .then((data) => {
        setMembers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("FETCH ERROR", err);
        setMembers([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const snapshotDateShown = useMemo(() => {
    const d = members?.[0]?.snapshot_date;
    return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
  }, [members]);

  const totalPoints = useMemo(() => {
    return members.reduce((acc, m) => acc + (Number(m.gexp_points) || 0), 0);
  }, [members]);

  const top1 = useMemo(() => members[0]?.nickname || "—", [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      const okQ = !q || (m.nickname || "").toLowerCase().includes(q);
      const okC = classFilter === "all" || String(m.class_id) === classFilter;
      return okQ && okC;
    });
  }, [members, query, classFilter]);

  const top3 = useMemo(() => filtered.slice(0, 3), [filtered]);

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
                Bienvenue chez PandoraHearts
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
          <StatCard title="Membres" value={members.length ? String(members.length) : "—"} hint={`Famille ${FAMILY}`} />
          <StatCard title="Total points" value={members.length ? totalPoints.toLocaleString() : "—"} hint="points" />
          <StatCard title="Top 1" value={members.length ? top1 : "—"} hint="Leader actuel" />
          <StatCard title="Mise à jour le" value={members.length ? snapshotDateShown : "—"} hint="Date stockée en base" />
        </section>

        {/* Content */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Podium */}
          <Panel className="lg:col-span-2" title="Top 3 — Podium" subtitle="Les meilleurs contributeurs">
            {loading ? <LoadingBlock /> : members.length === 0 ? <EmptyState /> : <Podium top3={top3} />}
          </Panel>

          {/* Leaderboard */}
          <Panel
            className="lg:col-span-3"
            title="Classement"
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
            {loading ? <LoadingBlock /> : members.length === 0 ? <EmptyState /> : <Leaderboard members={filtered} />}
          </Panel>
        </section>

        <footer className="text-center text-xs text-slate-500">
          Thème “fantasy” inspiré de l’univers Nostale • Historique multi-dates bientôt 🔥
        </footer>
      </div>
    </div>
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
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${map[tone] || map.purple}`}>
      {children}
    </span>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-5 hover:bg-slate-950/50 transition">
      <div className="text-sm text-slate-400">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-100">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
      <div className="mt-4 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full w-2/3 bg-gradient-to-r from-purple-500/60 to-cyan-400/40" />
      </div>
    </div>
  );
}

function Panel({ title, subtitle, right, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden ${className}`}>
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

function Podium({ top3 }) {
  const [first, second, third] = top3;
  return (
    <div className="grid grid-cols-3 gap-3 items-end">
      <PodiumCard place={2} member={second} />
      <PodiumCard place={1} member={first} />
      <PodiumCard place={3} member={third} />
    </div>
  );
}

function PodiumCard({ place, member }) {
  const styles = {
    1: "border-yellow-500/40 bg-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.08)]",
    2: "border-slate-400/40 bg-slate-400/10",
    3: "border-amber-700/40 bg-amber-700/10",
  };
  const medal = { 1: "👑", 2: "🥈", 3: "🥉" }[place];

  return (
    <div className={`rounded-2xl border p-4 text-center ${styles[place]}`}>
      <div className="text-2xl">{medal}</div>
      <div className="mt-2 text-xs text-slate-300">#{place}</div>
      <div className="mt-2 font-bold text-slate-100 truncate">{member?.nickname || "—"}</div>
      <div className="mt-1 text-xs text-slate-400">{member ? `${Number(member.gexp_points).toLocaleString()} pts` : "—"}</div>
      <div className="mt-3 flex justify-center">{member ? <ClassPill classId={member.class_id} /> : null}</div>
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
      {icon ? <img src={icon} alt={name} className="h-6 w-6 object-contain" /> : <span>❔</span>}
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