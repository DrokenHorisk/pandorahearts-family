// frontend/src/api.js
export const API_BASE =
  (import.meta?.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE) ||
  "https://api.pandorahearts-family.fr";
