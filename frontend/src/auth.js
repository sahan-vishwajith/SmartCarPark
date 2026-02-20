// src/auth.js
const API_BASE =
  import.meta.env?.VITE_API_BASE_URL || "http://localhost:5000";

const TOKEN_KEY = "authToken";
const USER_KEY = "currentUser";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token, user) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getCurrentUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Generic fetch that auto-attaches Authorization header if token exists
export async function authFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(
    path.startsWith("http") ? path : `${API_BASE}${path}`,
    {
      ...options,
      headers,
    }
  );

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore parse errors for empty responses
  }

  if (!res.ok) {
    const err = new Error(data?.error || "Request failed");
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

// Login & Register helpers
export async function login(username, password) {
  const data = await authFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setAuth(data.token, data.user);
  return data;
}

export async function registerUser(registerPayload) {
  const data = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(registerPayload),
  });
  setAuth(data.token, data.user);
  return data;
}
