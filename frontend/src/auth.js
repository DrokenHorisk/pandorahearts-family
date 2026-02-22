// frontend/src/auth.js
const KEY = "ph_token";
const KEY_USER = "ph_user";

export function saveAuth({ token, user }) {
  localStorage.setItem(KEY, token);
  localStorage.setItem(KEY_USER, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(KEY_USER);
}

export function getToken() {
  return localStorage.getItem(KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY_USER) || "null");
  } catch {
    return null;
  }
}

export function isAllowed(user) {
  if (!user?.role) return false;
  return user.role === "admin" || user.role === "superadmin";
}