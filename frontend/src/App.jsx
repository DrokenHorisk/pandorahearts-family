import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import HistoryDashboard from "./pages/HistoryDashboard";
import PlayerDashboard from "./pages/PlayerDashboard";
import Login from "./pages/Login";
import AdminImport from "./pages/AdminImport";

import { clearAuth, getUser, isAllowed } from "./auth";

function Protected({ children }) {
  const user = getUser();
  if (!isAllowed(user)) {
    return <Login />; // simple : si pas autorisé, on affiche login
  }
  return children;
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();

  const tab =
    location.pathname.startsWith("/history") ? "history" :
    location.pathname.startsWith("/admin") ? "admin" :
    location.pathname.startsWith("/player") ? "player" :
    "snapshot";

  const user = getUser();
  const allowed = isAllowed(user);

  return (
    <div>
      <nav className="flex gap-2 p-4 border-b border-slate-800 items-center">
        <TabButton active={tab === "snapshot"} onClick={() => navigate("/")}>
          Accueil
        </TabButton>

        <TabButton active={tab === "history"} onClick={() => navigate("/history")}>
          Historique
        </TabButton>

        {allowed ? (
          <TabButton active={tab === "admin"} onClick={() => navigate("/admin/import")}>
            Admin • Import
          </TabButton>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-slate-400">
                {user.username} • {user.role}
              </span>
              <button
                onClick={() => { clearAuth(); navigate("/login"); }}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 hover:text-slate-100"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 hover:text-slate-100"
            >
              Connexion
            </button>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/history" element={<HistoryDashboard />} />
        <Route path="/player/:nickname" element={<PlayerDashboard />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin/import"
          element={
            <Protected>
              <AdminImport />
            </Protected>
          }
        />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

function TabButton({ active, children, ...props }) {
  return (
    <button
      {...props}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition
        ${
          active
            ? "bg-purple-500/20 text-purple-200 border border-purple-500/40"
            : "bg-slate-900 text-slate-400 hover:text-slate-200"
        }`}
    >
      {children}
    </button>
  );
}