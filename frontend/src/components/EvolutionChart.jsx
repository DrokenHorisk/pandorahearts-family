// frontend/src/components/EvolutionChart.jsx
import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Brush,
  Cell,
} from "recharts";

function fmtDateFR(yyyyMmDd) {
  const [y, m, d] = (yyyyMmDd || "").split("-");
  if (!y || !m || !d) return yyyyMmDd;
  return `${d}/${m}/${y}`;
}

function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export default function EvolutionChart({ dates = [], series = {} }) {
  const [mode, setMode] = useState("total"); // "total" | "delta"
  const [showBrush, setShowBrush] = useState(true);

  const data = useMemo(() => {
    // dates ASC dans ton backend
    const totalsAsc = (dates || []).map((d) => ({
      date: d,
      label: fmtDateFR(d),
      total: num(series?.[d]),
    }));

    // delta chronologique : total(i) - total(i-1)
    return totalsAsc.map((row, i) => {
      const prev = i > 0 ? totalsAsc[i - 1].total : null;
      const delta = prev === null ? null : row.total - prev;
      return { ...row, delta };
    });
  }, [dates, series]);

  const yDomainTotal = useMemo(() => {
    const vals = data.map((r) => r.total).filter((v) => Number.isFinite(v));
    if (!vals.length) return ["auto", "auto"];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) return [min - 1, max + 1];
    const pad = (max - min) * 0.06;
    return [min - pad, max + pad];
  }, [data]);

  const yDomainDelta = useMemo(() => {
    const vals = data
      .map((r) => r.delta)
      .filter((v) => v !== null && Number.isFinite(v));
    if (!vals.length) return ["auto", "auto"];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) return [min - 1, max + 1];
    const pad = (max - min) * 0.15;
    return [min - pad, max + pad];
  }, [data]);

  if (!data.length) return <div className="text-slate-400">Aucun point à afficher.</div>;

  // Couleurs cohérentes avec ton UI + textes lisibles
  const C = {
    grid: "rgba(148,163,184,0.18)",
    axis: "rgba(34,211,238,0.9)",        // ticks X/Y cyan
    tooltipText: "rgba(165,243,252,1)",  // cyan-200
    tooltipBorder: "rgba(34,211,238,0.4)",
    totalLine: "rgba(168,85,247,0.95)",  // violet
    barPos: "rgba(34,211,238,0.85)",     // cyan
    barNeg: "rgba(248,113,113,0.85)",    // rouge
  };

  // Tooltip commun (évite le texte noir sur "Δ")
  const commonTooltipProps = {
    contentStyle: {
      background: "rgba(2,6,23,0.95)", // slate-950
      border: `1px solid ${C.tooltipBorder}`,
      borderRadius: 12,
      color: C.tooltipText,            // ← TEXTE PAR DÉFAUT
    },
    labelStyle: {
      color: C.tooltipText,
      fontWeight: 700,
    },
    itemStyle: {
      color: C.tooltipText,            // ← IMPORTANT: sinon Recharts met du noir sur la valeur (Δ)
      fontWeight: 700,
    },
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
              mode === "total"
                ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                : "bg-slate-950/40 text-slate-300 border-slate-700 hover:text-slate-100"
            }`}
            onClick={() => setMode("total")}
          >
            Total cumulé
          </button>

          <button
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition border ${
              mode === "delta"
                ? "bg-purple-500/20 text-purple-200 border-purple-500/40"
                : "bg-slate-950/40 text-slate-300 border-slate-700 hover:text-slate-100"
            }`}
            onClick={() => setMode("delta")}
          >
            Δ entre 2 mises à jour
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={showBrush}
            onChange={(e) => setShowBrush(e.target.checked)}
          />
          Zoom (brush)
        </label>
      </div>

      {/* Chart */}
      <div className="w-full h-[320px] rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
        <ResponsiveContainer>
          {mode === "total" ? (
            <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />

              <XAxis dataKey="label" minTickGap={20} tick={{ fontSize: 12, fill: C.axis }} />
              <YAxis
                width={70}
                domain={yDomainTotal}
                tick={{ fontSize: 12, fill: C.axis }}
                tickFormatter={(v) => Number(v).toLocaleString()}
              />

              <Tooltip
                {...commonTooltipProps}
                formatter={(value, name) => {
                  if (name === "total") return [Number(value).toLocaleString(), "Total"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />

              <Line
                type="monotone"
                dataKey="total"
                stroke={C.totalLine}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />

              {showBrush ? <Brush dataKey="label" height={22} travellerWidth={10} /> : null}
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" />

              <XAxis dataKey="label" minTickGap={20} tick={{ fontSize: 12, fill: C.axis }} />
              <YAxis
                width={70}
                domain={yDomainDelta}
                tick={{ fontSize: 12, fill: C.axis }}
                tickFormatter={(v) => Number(v).toLocaleString()}
              />

              <Tooltip
                {...commonTooltipProps}
                formatter={(value) => {
                  if (value === null || value === undefined) return ["—", "Δ"];
                  const n = Number(value);
                  const sign = n > 0 ? "+" : "";
                  return [`${sign}${n.toLocaleString()}`, "Δ"];
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />

              <Bar dataKey="delta" radius={[10, 10, 0, 0]} isAnimationActive={false}>
                {data.map((row, idx) => {
                  const v = row.delta;
                  const fill = v !== null && v < 0 ? C.barNeg : C.barPos;
                  return <Cell key={`cell-${idx}`} fill={fill} />;
                })}
              </Bar>

              {showBrush ? <Brush dataKey="label" height={22} travellerWidth={10} /> : null}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="text-xs text-slate-500">
        Total = valeurs cumulées importées • Δ = gain entre deux mise à jour consécutives
      </div>
    </div>
  );
}