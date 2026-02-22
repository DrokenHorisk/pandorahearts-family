// frontend/src/api/api.js
export const API_BASE =
  (import.meta?.env?.VITE_API_BASE && import.meta.env.VITE_API_BASE) ||
  "http://192.168.0.30:8000";
