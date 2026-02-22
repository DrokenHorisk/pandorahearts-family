import React, { useMemo, useState } from "react";
import { API_BASE } from "../api";
import { getToken } from "../auth";

const FAMILY = "PandoraHearts";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminImport() {
  const [gmbrFile, setGmbrFile] = useState(null);
  const [gexpFile, setGexpFile] = useState(null);
  const [snapshotDate, setSnapshotDate] = useState(todayISO());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const canImport = useMemo(() => !!gmbrFile && !!gexpFile && !!snapshotDate, [gmbrFile, gexpFile, snapshotDate]);

  const handleImport = async () => {
    if (!canImport) return;

    setImporting(true);
    setImportMsg("");

    try {
      const token = getToken();
      if (!token) throw new Error("Pas connecté");

      const fd = new FormData();
      fd.append("gmbr", gmbrFile);
      fd.append("gexp", gexpFile);

      const url =
        `${API_BASE}/family/${encodeURIComponent(FAMILY)}/import` +
        `?snapshot_date=${encodeURIComponent(snapshotDate)}`;

      const res = await fetch(url, {
        method: "POST",
        body: fd,
        headers: {
          Authorization: `Bearer ${token}`, // 🔒
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      setImportMsg("✅ Import réussi !");
      setGmbrFile(null);
      setGexpFile(null);
    } catch (e) {
      setImportMsg(`❌ Import échoué: ${e?.message || e}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <header className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
            <span className="text-cyan-300">✦</span> Admin • Import
          </div>
          <h1 className="mt-3 text-3xl font-extrabold">Importer des fichiers</h1>
          <p className="mt-2 text-slate-400">Réservé à Droken/Admin</p>
        </header>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-950/35 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100">Import</h2>
              <p className="text-sm text-slate-400">gmbr + gexp + date de maj</p>
            </div>

            <button
              onClick={handleImport}
              disabled={importing || !canImport}
              className="rounded-xl px-4 py-2 text-sm font-semibold border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing ? "Import en cours…" : "Lancer l’import"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <label className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-slate-100">Date de la mise à jour</div>
              <input
                type="date"
                className="mt-3 w-full rounded-xl bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
              />
            </label>

            <label className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-slate-100">Fichier gmbr</div>
              <input
                type="file"
                className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200 hover:file:bg-slate-700"
                onChange={(e) => setGmbrFile(e.target.files?.[0] || null)}
              />
              {gmbrFile ? <div className="mt-2 text-xs text-slate-400 truncate">📎 {gmbrFile.name}</div> : null}
            </label>

            <label className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-4">
              <div className="text-sm font-semibold text-slate-100">Fichier gexp</div>
              <input
                type="file"
                className="mt-3 block w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200 hover:file:bg-slate-700"
                onChange={(e) => setGexpFile(e.target.files?.[0] || null)}
              />
              {gexpFile ? <div className="mt-2 text-xs text-slate-400 truncate">📎 {gexpFile.name}</div> : null}
            </label>
          </div>

          {importMsg ? <div className="text-sm text-slate-300">{importMsg}</div> : null}
        </section>
      </div>
    </div>
  );
}