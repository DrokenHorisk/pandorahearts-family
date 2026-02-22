import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import { saveAuth } from "../auth";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("username", username);
      fd.append("password", password);

      const res = await fetch(`${API_BASE}/auth/login`, { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const json = await res.json();

      saveAuth({
        token: json.access_token,
        user: { username: json.username, role: json.role },
      });

      nav("/"); // ou /admin/import si tu veux
    } catch (e) {
      setMsg(`❌ Login échoué: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-950/40 p-6">
        <h1 className="text-2xl font-extrabold">Connexion</h1>
        <p className="mt-2 text-sm text-slate-400">Accès admin requis pour l’import.</p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
            placeholder="Username (Droken / Admin)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full rounded-xl bg-slate-950/60 border border-slate-700 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400/40"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? handleLogin() : null)}
          />

          <button
            onClick={handleLogin}
            disabled={loading || !username || !password}
            className="w-full rounded-xl px-4 py-2 text-sm font-semibold border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/15 disabled:opacity-40"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>

          {msg ? <div className="text-sm text-slate-300">{msg}</div> : null}
        </div>
      </div>
    </div>
  );
}