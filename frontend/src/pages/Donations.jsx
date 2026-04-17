// frontend/src/pages/Donations.jsx

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../api";
import { getUser, getToken, isAllowed } from "../auth";

const FAMILY = "PandoraHearts";

function clampAmount(v) {
  // accepte string/number, renvoie int >= 0
  const n = Number(String(v).replace(/\s/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function formatIntFR(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  return Math.trunc(x).toLocaleString("fr-FR"); // espaces fines selon navigateur
}

function statusPill(gave) {
  return gave
    ? {
        label: "Donné",
        cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      }
    : {
        label: "Pas donné",
        cls: "border-red-400/30 bg-red-400/10 text-red-200",
      };
}

export default function Donations() {
  const user = getUser();
  const canEdit = isAllowed(user);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [mains, setMains] = useState([]);
  const [donations, setDonations] = useState({});
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "nickname", dir: "asc" });

  const [resetting, setResetting] = useState(false);

  // ===============================
  // FETCH DATA
  // ===============================
  useEffect(() => {
    if (!canEdit) return;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const token = getToken();

        const [mainsRes, donationsRes] = await Promise.all([
          fetch(`${API_BASE}/family/${FAMILY}/mains`),
          fetch(`${API_BASE}/family/${FAMILY}/donations`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const mainsData = await mainsRes.json();
        const donationsData = await donationsRes.json();

        setMains(Array.isArray(mainsData) ? mainsData : []);
        setDonations(donationsData || {});
      } catch (e) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [canEdit]);

  // ===============================
  // UPDATE BACKEND
  // ===============================
  async function updateDonation(player_id, next) {
    await fetch(`${API_BASE}/family/${FAMILY}/donations/${player_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(next),
    });
  }

  function setGave(player_id, gave) {
    const key = String(player_id);
    const cur = donations?.[key] || { gave: false, amount: 0 };
    const next = { ...cur, gave: !!gave };

    setDonations((prev) => ({ ...prev, [key]: next }));
    updateDonation(player_id, next).catch((e) =>
      console.error("Erreur update donation", e)
    );
  }

  function setAmount(player_id, amount) {
    const key = String(player_id);
    const cur = donations?.[key] || { gave: false, amount: 0 };
    const next = { ...cur, amount: clampAmount(amount) };

    setDonations((prev) => ({ ...prev, [key]: next }));
    updateDonation(player_id, next).catch((e) =>
      console.error("Erreur update donation", e)
    );
  }

  // ===============================
  // RESET ALL
  // ===============================
  async function resetAll() {
    if (resetting) return;

    const ok = window.confirm(
      "⚠️ Reset total : tous les dons seront remis à 0 et décochés.\n\nConfirmer ?"
    );
    if (!ok) return;

    setResetting(true);
    setErr("");

    try {
      // Optimistic UI: tout à zéro
      const nextMap = {};
      for (const m of mains) {
        nextMap[String(m.player_id)] = { gave: false, amount: 0 };
      }
      setDonations(nextMap);

      // Push backend: 1 PUT par player (simple, robuste)
      await Promise.all(
        mains.map((m) =>
          updateDonation(m.player_id, { gave: false, amount: 0 })
        )
      );
    } catch (e) {
      setErr(
        "Reset échoué (backend). Recharge la page et réessaie.\n" +
          String(e?.message || e)
      );
    } finally {
      setResetting(false);
    }
  }

  // ===============================
  // SORTING
  // ===============================
  function toggleSort(key) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }

  function sortIndicator(key) {
    return sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = [...mains];

    const filtered = !needle
      ? base
      : base.filter((m) =>
          String(m.nickname || "").toLowerCase().includes(needle)
        );

    filtered.sort((a, b) => {
      const aItem = donations?.[String(a.player_id)] || { gave: false };
      const bItem = donations?.[String(b.player_id)] || { gave: false };

      if (sort.key === "gave") {
        const av = aItem.gave ? 1 : 0;
        const bv = bItem.gave ? 1 : 0;
        if (av !== bv) {
          return sort.dir === "asc" ? av - bv : bv - av;
        }
      }

      return (
        String(a.nickname || "").localeCompare(
          String(b.nickname || ""),
          "fr",
          { sensitivity: "base" }
        ) * (sort.dir === "asc" ? 1 : -1)
      );
    });

    return filtered;
  }, [mains, q, donations, sort]);

  // ===============================
  // TOTAL
  // ===============================
  const total = useMemo(() => {
    return Object.values(donations).reduce((sum, d) => {
      if (d?.gave) return sum + clampAmount(d.amount);
      return sum;
    }, 0);
  }, [donations]);

  // ===============================
  // GUARD
  // ===============================
  if (!canEdit) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        Accès réservé aux admin/superadmin.
      </div>
    );
  }

  // ===============================
  // RENDER
  // ===============================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <Link
          to="/"
          className="text-sm text-slate-300 hover:text-purple-300 underline"
        >
          ← Retour
        </Link>

        <header className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-6">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-[240px]">
              <h1 className="text-3xl font-extrabold">Suivi des dons</h1>
              <p className="text-slate-400 mt-2">
                Liste des principales • Total dynamique
              </p>
            </div>

            <div className="ml-auto flex items-center gap-3 flex-wrap">
              <button
                onClick={resetAll}
                disabled={loading || resetting || mains.length === 0}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold
                  ${
                    loading || resetting || mains.length === 0
                      ? "border-slate-700 text-slate-500 cursor-not-allowed"
                      : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                  }`}
                title="Remet tous les dons à zéro"
              >
                {resetting ? "Reset…" : "Reset tout"}
              </button>

              <div className="text-lg font-mono font-bold">
                Total : {formatIntFR(total)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-4 flex-wrap">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Recherche pseudo..."
              className="rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm"
            />
          </div>

          {err && <div className="mt-3 text-red-300 text-sm whitespace-pre-line">{err}</div>}
        </header>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-6">
          {loading ? (
            <div className="text-slate-400">Chargement…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-xs uppercase text-slate-400">
                    <th
                      className="px-3 cursor-pointer"
                      onClick={() => toggleSort("nickname")}
                    >
                      Pseudo{sortIndicator("nickname")}
                    </th>
                    <th
                      className="px-3 cursor-pointer"
                      onClick={() => toggleSort("gave")}
                    >
                      Statut{sortIndicator("gave")}
                    </th>
                    <th className="px-3 text-center">A donné</th>
                    <th className="px-3 text-right">Montant</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((m) => {
                    const pid = m.player_id;
                    const item = donations?.[String(pid)] || {
                      gave: false,
                      amount: 0,
                    };
                    const pill = statusPill(item.gave);

                    return (
                      <tr
                        key={pid}
                        className="bg-slate-950/40 border border-slate-800 rounded-xl"
                      >
                        <td className="px-3 py-3 font-semibold">{m.nickname}</td>

                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pill.cls}`}
                          >
                            {pill.label}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!item.gave}
                            onChange={(e) => setGave(pid, e.target.checked)}
                            className="h-5 w-5 accent-emerald-400 cursor-pointer"
                          />
                        </td>

                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <input
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={item.amount > 0 ? item.amount : ""}
                              placeholder="Valeur du don"
                              onChange={(e) => setAmount(pid, e.target.value)}
                              className="w-36 rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm font-mono text-right"
                            />
                            <div className="text-xs text-slate-400 font-mono">
                              {formatIntFR(item.amount)}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}