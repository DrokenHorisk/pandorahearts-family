// frontend/src/pages/PlayerDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import { CLASS_NAMES, CLASS_ICONS } from "../constants/classes";
import EvolutionChart from "../components/EvolutionChart";
import { getToken, getUser, isAllowed } from "../auth";

const ROLE_LABELS = {
  Principale: "Principale",
  Secondaire: "Secondaire",
  Mule: "Mule",
};

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

  // --- Nickname edit ---
  const [editing, setEditing] = useState(false);
  const [newNick, setNewNick] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Role/link edit (FR) ---
  const [mains, setMains] = useState([]);
  const [roleEdit, setRoleEdit] = useState("Principale");
  const [mainEditId, setMainEditId] = useState("");
  const [roleMsg, setRoleMsg] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  // ✅ Admin - delete player
  const [deleting, setDeleting] = useState(false);
  const [adminMsg, setAdminMsg] = useState("");

  // ✅ Admin - edit points for a specific date
  const [editingDate, setEditingDate] = useState(null); // "YYYY-MM-DD"
  const [editingValue, setEditingValue] = useState("");
  const [savingPoint, setSavingPoint] = useState(false);

  // ✅ Admin - import snapshot from this page
  const [importGmbr, setImportGmbr] = useState(null);
  const [importGexp, setImportGexp] = useState(null);
  const [importDate, setImportDate] = useState(""); // optional
  const [importing, setImporting] = useState(false);

  const normalizeRole = (role) => (role ? role : "Principale");
  const isPrincipale = (role) => normalizeRole(role) === "Principale";
  const needsMain = (role) => role === "Secondaire" || role === "Mule";

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

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
      .then(async (r) => {
        if (!r.ok) {
          throw new Error((await r.text().catch(() => "")) || `HTTP ${r.status}`);
        }
        return r.json();
      })
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

  // init role inputs quand data change
  useEffect(() => {
    const p = data?.player;
    if (!p) return;

    const role = normalizeRole(p.role);
    setRoleEdit(role);

    const mainIdStr = p.main_player_id ? String(p.main_player_id) : "";
    setMainEditId(mainIdStr);
  }, [data?.player]);

  // load mains (dropdown) si admin
  useEffect(() => {
    if (!canEdit) return;

    fetch(`${API_BASE}/family/${family}/mains`)
      .then((r) => r.json())
      .then((arr) => setMains(Array.isArray(arr) ? arr : []))
      .catch(() => setMains([]));
  }, [canEdit]);

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

      setData((prev) =>
        prev
          ? { ...prev, player: { ...prev.player, nickname: updated.nickname } }
          : prev
      );

      setEditing(false);
      setSaveMsg("✅ Pseudo mis à jour");

      navigate(`/player/${encodeURIComponent(updated.nickname)}`, {
        replace: true,
      });
    } catch (e) {
      setSaveMsg(`❌ ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveRoleLink() {
    setSavingRole(true);
    setRoleMsg("");
    try {
      const token = getToken();
      if (!token) throw new Error("Pas connecté");

      const role = normalizeRole(roleEdit);

      const main_player_id = isPrincipale(role)
        ? null
        : mainEditId
        ? Number(mainEditId)
        : null;

      if (!isPrincipale(role) && !main_player_id) {
        throw new Error("Tu dois sélectionner un personnage principal.");
      }

      const res = await fetch(
        `${API_BASE}/family/${family}/player/${data.player.player_id}/role-link`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role, main_player_id }),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const mainObj = isPrincipale(role)
        ? null
        : mains.find((x) => String(x.player_id) === String(main_player_id));

      setData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          player: {
            ...prev.player,
            role,
            main_player_id,
            main_nickname: isPrincipale(role)
              ? null
              : mainObj?.nickname || prev.player.main_nickname || null,
          },
        };
      });

      setRoleMsg("✅ Rôle / lien mis à jour");
    } catch (e) {
      setRoleMsg(`❌ ${e?.message || e}`);
    } finally {
      setSavingRole(false);
    }
  }

  async function deletePlayer() {
    if (!canEdit) return;
    if (!data?.player?.player_id) return;

    const ok = window.confirm(
      `Supprimer définitivement "${data.player.nickname}" ?\n\n⚠️ Cette action est irréversible.`
    );
    if (!ok) return;

    setDeleting(true);
    setAdminMsg("");
    try {
      const token = getToken();
      if (!token) throw new Error("Pas connecté");

      const res = await fetch(
        `${API_BASE}/family/${family}/players/${data.player.player_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setAdminMsg("✅ Personnage supprimé");
      navigate("/history", { replace: true });
    } catch (e) {
      setAdminMsg(`❌ ${e?.message || e}`);
    } finally {
      setDeleting(false);
    }
  }

  function startEditPoint(dateStr, currentVal) {
    if (!canEdit) return;
    setAdminMsg("");
    setEditingDate(dateStr);
    setEditingValue(String(Number(currentVal ?? 0)));
  }

  function cancelEditPoint() {
    setEditingDate(null);
    setEditingValue("");
  }

  async function savePoint(dateStr) {
    if (!canEdit) return;
    if (!data?.player?.player_id) return;

    // ✅ accept "12 345" / "12,345" etc.
    const raw = String(editingValue ?? "").trim();
    const cleaned = raw.replace(/[^\d]/g, "");
    const value = Number(cleaned);

    if (!Number.isFinite(value) || value < 0) {
      setAdminMsg("❌ Valeur invalide (nombre >= 0 attendu).");
      return;
    }

    setSavingPoint(true);
    setAdminMsg("");

    const oldVal = Number(data?.series?.[dateStr] ?? 0);

    // optimistic update (series)
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        series: { ...(prev.series || {}), [dateStr]: value },
      };
    });

    try {
      const token = getToken();
      if (!token) throw new Error("Pas connecté");

      const res = await fetch(
        `${API_BASE}/family/${family}/players/${data.player.player_id}/points`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ snapshot_date: dateStr, value }),
        }
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setAdminMsg("✅ Point mis à jour");
      cancelEditPoint();

      // ✅ refresh from API so stats stay consistent (last_value/diffs)
      const r2 = await fetch(
        `${API_BASE}/family/${family}/player/by-nickname/${encodeURIComponent(
          nickname
        )}?from_date=${fromDate}&to_date=${toDate}`
      );
      const j2 = await r2.json();
      if (j2?.player) setData(j2);
    } catch (e) {
      // rollback
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          series: { ...(prev.series || {}), [dateStr]: oldVal },
        };
      });
      setAdminMsg(`❌ ${e?.message || e}`);
    } finally {
      setSavingPoint(false);
    }
  }

  async function importSnapshot() {
    if (!canEdit) return;

    setImporting(true);
    setAdminMsg("");

    try {
      const token = getToken();
      if (!token) throw new Error("Pas connecté");
      if (!importGmbr || !importGexp) throw new Error("Sélectionne gmbr + gexp");

      const fd = new FormData();
      fd.append("gmbr", importGmbr);
      fd.append("gexp", importGexp);

      const qs = importDate
        ? `?snapshot_date=${encodeURIComponent(importDate)}`
        : "";

      const res = await fetch(`${API_BASE}/family/${family}/import${qs}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setAdminMsg("✅ Import terminé. Actualisation…");

      const r2 = await fetch(
        `${API_BASE}/family/${family}/player/by-nickname/${encodeURIComponent(
          nickname
        )}?from_date=${fromDate}&to_date=${toDate}`
      );
      const j2 = await r2.json();
      if (j2?.player) setData(j2);

      setImportGmbr(null);
      setImportGexp(null);
      setImportDate("");
    } catch (e) {
      setAdminMsg(`❌ ${e?.message || e}`);
    } finally {
      setImporting(false);
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

  const roleShown = normalizeRole(data?.player?.role);

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
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
                  <span className="text-purple-300">✦</span>
                  Détails Joueur
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  {!editing ? (
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                        <span className="text-slate-100">
                          {data.player.nickname}
                        </span>
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

                  {saveMsg ? (
                    <div className="text-sm text-slate-300">{saveMsg}</div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <ClassBadge classId={data.player.class_id} />

                  <span className="text-sm text-slate-300">
                    Niveau{" "}
                    <span className="font-bold text-slate-100">
                      {data.player.level}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-200">
                    Rôle:{" "}
                    <span className="text-cyan-200">
                      {ROLE_LABELS[roleShown] || roleShown}
                    </span>
                  </span>

                  {!isPrincipale(roleShown) && data.player.main_nickname ? (
                    <Link
                      to={`/player/${encodeURIComponent(
                        data.player.main_nickname
                      )}`}
                      className="text-xs text-slate-300 hover:text-purple-300 underline decoration-slate-700 hover:decoration-purple-400"
                      title="Voir le personnage principal"
                    >
                      Principal: {data.player.main_nickname}
                    </Link>
                  ) : null}
                </div>

                <p className="mt-3 text-slate-400">
                  Valeurs importées ={" "}
                  <span className="text-slate-200">totaux cumulés</span>. Les Δ
                  représentent des gains.
                </p>

                {/* ✅ ADMIN PANEL: delete + import snapshot */}
                {canEdit ? (
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                    <div className="text-xs uppercase text-slate-500 tracking-wider">
                      Admin • Actions
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                      <button
                        onClick={deletePlayer}
                        disabled={deleting}
                        className="px-4 py-2 rounded-xl text-sm font-semibold border border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400/15 disabled:opacity-40"
                        title="Supprimer définitivement ce personnage"
                      >
                        {deleting
                          ? "Suppression…"
                          : "🗑️ Supprimer le personnage"}
                      </button>

                      {adminMsg ? (
                        <div className="text-sm text-slate-300">{adminMsg}</div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* ✅ ADMIN: Role editor (FR) */}
                {canEdit ? (
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-xs uppercase text-slate-500 tracking-wider">
                      Admin • Rôle
                    </div>

                    <div className="mt-3 flex flex-col md:flex-row gap-3 md:items-end">
                      <div>
                        <label className="block text-xs text-slate-400">
                          Rôle
                        </label>
                        <select
                          className="mt-1 rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
                          value={roleEdit}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRoleEdit(v);
                            setRoleMsg("");
                            if (isPrincipale(v)) setMainEditId("");
                          }}
                        >
                          <option value="Principale">Principale</option>
                          <option value="Secondaire">Secondaire</option>
                          <option value="Mule">Mule</option>
                        </select>
                      </div>

                      {needsMain(roleEdit) ? (
                        <div className="flex-1 min-w-[240px]">
                          <label className="block text-xs text-slate-400">
                            Rattaché à (personnage principal)
                          </label>
                          <select
                            className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
                            value={mainEditId}
                            onChange={(e) => {
                              setMainEditId(e.target.value);
                              setRoleMsg("");
                            }}
                          >
                            <option value="">— choisir un principal —</option>
                            {mains.map((m) => (
                              <option
                                key={m.player_id}
                                value={String(m.player_id)}
                              >
                                {m.nickname}
                              </option>
                            ))}
                          </select>

                          <div className="mt-1 text-xs text-slate-500">
                            Obligatoire pour{" "}
                            <span className="text-slate-300">Secondaire</span> /{" "}
                            <span className="text-slate-300">Mule</span>.
                          </div>
                        </div>
                      ) : null}

                      <button
                        onClick={saveRoleLink}
                        disabled={
                          savingRole || (needsMain(roleEdit) && !mainEditId)
                        }
                        className="px-4 py-2 rounded-xl text-sm font-semibold border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-40"
                      >
                        {savingRole ? "Sauvegarde…" : "Enregistrer rôle"}
                      </button>
                    </div>

                    {roleMsg ? (
                      <div className="mt-2 text-sm text-slate-300">{roleMsg}</div>
                    ) : null}
                  </div>
                ) : null}

                {/* ✅ PRINCIPALE: show linked members */}
                {isPrincipale(data?.player?.role) &&
                Array.isArray(data.player.linked_members) &&
                data.player.linked_members.length ? (
                  <section className="mt-6 rounded-2xl border border-slate-700/60 bg-slate-950/35 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800">
                      <h2 className="text-lg font-bold text-slate-100">
                        Personnages liés
                      </h2>
                      <p className="text-sm text-slate-400">
                        Mules / secondaires rattachés à ce principal
                      </p>
                    </div>
                    <div className="p-6">
                      <ul className="space-y-2">
                        {data.player.linked_members.map((lm) => {
                          const roleLabel =
                            ROLE_LABELS[normalizeRole(lm.role)] || normalizeRole(lm.role);

                          const className = CLASS_NAMES?.[lm.class_id] || `Classe ${lm.class_id}`;
                          const iconSrc = CLASS_ICONS?.[lm.class_id];

                          return (
                            <li
                              key={lm.player_id}
                              className="rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2 flex items-center justify-between gap-3"
                            >
                              {/* Left: class icon + nickname */}
                              <Link
                                to={`/player/${encodeURIComponent(lm.nickname)}`}
                                className="flex items-center gap-2 font-semibold text-slate-100 hover:text-purple-300 hover:underline min-w-0"
                                title={`Voir ${lm.nickname}`}
                              >
                                {iconSrc ? (
                                  <img
                                    src={iconSrc}
                                    alt={className}
                                    className="h-7 w-7 rounded-lg border border-slate-700 bg-slate-950/50 p-1 shrink-0"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="h-7 w-7 rounded-lg border border-slate-700 bg-slate-950/50 flex items-center justify-center text-[10px] text-slate-300 shrink-0">
                                    {lm.class_id}
                                  </span>
                                )}

                                <span className="truncate">{lm.nickname}</span>
                              </Link>

                              {/* Right: role pill */}
                              <span className="text-xs rounded-full border border-slate-700 bg-slate-950/50 px-2 py-1 text-slate-200 shrink-0">
                                {roleLabel}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </section>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 min-w-[280px]">
                <div className="text-xs uppercase text-slate-500 tracking-wider">
                  Période
                </div>

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
            <h2 className="text-lg font-bold text-slate-100">
              Évolution (graphique)
            </h2>
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
            <p className="text-sm text-slate-400">
              Mises à jour les plus recentes en haut
              {canEdit ? " • (admin) clique ✏️ pour modifier un total" : ""}
            </p>
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
                      {canEdit ? <th className="px-3 text-right">Admin</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((row, idx) => {
                      const next = idx > 0 ? points[idx - 1].value : null;
                      const delta = next === null ? null : next - row.value;

                      const isEditing = canEdit && editingDate === row.date;

                      return (
                        <tr
                          key={row.date}
                          className="rounded-xl bg-slate-950/40 border border-slate-800"
                        >
                          <td className="px-3 py-3 font-mono text-sm text-slate-200">
                            {row.date}
                          </td>

                          <td className="px-3 py-3 text-right font-mono font-bold">
                            {isEditing ? (
                              <input
                                autoFocus
                                inputMode="numeric"
                                className="w-[140px] text-right rounded-xl bg-slate-950/60 border border-slate-700 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500/40"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEditPoint();
                                  }
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    savePoint(row.date);
                                  }
                                }}
                                disabled={savingPoint}
                              />
                            ) : (
                              row.value.toLocaleString()
                            )}
                          </td>

                          <DiffTd value={delta} />

                          {canEdit ? (
                            <td className="px-3 py-3 text-right">
                              {isEditing ? (
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => savePoint(row.date)}
                                    disabled={savingPoint}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15 disabled:opacity-40"
                                  >
                                    {savingPoint ? "…" : "✅"}
                                  </button>
                                  <button
                                    onClick={cancelEditPoint}
                                    disabled={savingPoint}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-950/70 disabled:opacity-40"
                                  >
                                    ✖️
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEditPoint(row.date, row.value)}
                                  className="px-3 py-2 rounded-xl text-xs font-semibold border border-purple-400/30 bg-purple-400/10 text-purple-200 hover:bg-purple-400/15"
                                  title="Modifier le total pour cette date"
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

                {canEdit && adminMsg ? (
                  <div className="mt-3 text-sm text-slate-300">{adminMsg}</div>
                ) : null}
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
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
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
  const color =
    n > 0 ? "text-emerald-400" : n < 0 ? "text-red-400" : "text-slate-300";
  const sign = n > 0 ? "+" : "";
  return (
    <td className={`px-3 py-3 text-right font-mono ${color}`}>
      {sign}
      {n.toLocaleString()}
    </td>
  );
}