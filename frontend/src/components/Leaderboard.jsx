// frontend/src/components/Leaderboard.jsx
import React from "react";
import { CLASS_NAMES, CLASS_ICONS } from "../constants/classes";
import { Link } from "react-router-dom";

export default function Leaderboard({ members }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
            <th className="px-3">#</th>
            <th className="px-3">Pseudo</th>
            <th className="px-3">Niveau</th>
            <th className="px-3 text-right">Points</th>
          </tr>
        </thead>

        <tbody>
          {members.map((m, i) => (
            <tr
              key={`${m.player_id}-${i}`}
              className={`group rounded-xl ${
                i === 0
                  ? "bg-purple-500/10 border border-purple-500/20"
                  : "bg-slate-950/40 border border-slate-800"
              }`}
            >
              <td className="px-3 py-3 w-12">
                <div className="text-sm font-mono text-slate-300">{i + 1}</div>
              </td>

              <td className="px-3 py-3 min-w-[180px]">
                <div className="flex items-center gap-3">
                  <img
                    src={CLASS_ICONS[m.class_id]}
                    alt={CLASS_NAMES[m.class_id]}
                    className="h-10 w-10 rounded-xl border border-slate-700 bg-slate-900/60 p-1 object-contain"
                    />
                  <div>
                    <Link
                      to={`/player/${encodeURIComponent(m.nickname)}`}
                      className="font-semibold text-slate-100 group-hover:text-purple-300 transition underline decoration-slate-700 hover:decoration-purple-400"
                    >
                      {m.nickname}
                    </Link>
                    {/* <div className="text-xs text-slate-500 font-mono">
                      ID {m.player_id}
                    </div> */}
                  </div>
                  {i === 0 ? (
                    <span className="ml-auto text-xs px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-200">
                      Leader
                    </span>
                  ) : null}
                </div>
              </td>

              <td className="px-3 py-3">
                <span className="text-sm text-slate-200 font-semibold">
                  {m.level}
                </span>
              </td>

              <td className="px-3 py-3 text-right">
                <span className="text-sm font-mono font-bold text-slate-100">
                  {Number(m.gexp_points).toLocaleString()}
                </span>
                <span className="ml-2 text-xs text-slate-500">pts</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassBadge({ classId }) {
  const colorMap = {
    1: "bg-blue-500/15 text-blue-200 border-blue-500/30",
    2: "bg-red-500/15 text-red-200 border-red-500/30",
    3: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    4: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  };

  const name = CLASS_NAMES?.[classId] || `Classe ${classId}`;
  const icon = CLASS_ICONS?.[classId];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
        colorMap[classId] || "bg-slate-500/10 text-slate-200 border-slate-600/30"
      }`}
      title={name}
    >
      {icon ? (
        <img
          src={icon}
          alt={name}
          className="h-5 w-5 object-contain"
        />
      ) : (
        <span className="text-sm">❔</span>
      )}

      <span>{name}</span>
    </span>
  );
}

