// Admin-side API client. Uses a SEPARATE token (admin JWT) and storage key.

const API_BASE = "http://localhost:5000";

export const ADMIN_STORAGE = {
  TOKEN: "adminAuthToken",
  ADMIN: "adminAuthUser",
};

export function getAdminToken() {
  return localStorage.getItem(ADMIN_STORAGE.TOKEN) || null;
}

export function setAdminAuth(token, admin) {
  localStorage.setItem(ADMIN_STORAGE.TOKEN, token);
  if (admin) localStorage.setItem(ADMIN_STORAGE.ADMIN, JSON.stringify(admin));
}

export function clearAdminAuth() {
  localStorage.removeItem(ADMIN_STORAGE.TOKEN);
  localStorage.removeItem(ADMIN_STORAGE.ADMIN);
}

export function getStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE.ADMIN);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function adminFetch(path, { method = "GET", body, query } = {}) {
  const token = getAdminToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const qs = query
    ? "?" +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";

  const res = await fetch(`${API_BASE}${path}${qs}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---------- specific calls ----------

export const adminAuthApi = {
  login: (username, password) =>
    fetch(`${API_BASE}/api/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || d.error || "Login failed");
      return d;
    }),
  me: () => adminFetch("/api/admin/auth/me"),
};

export const adminApi = {
  overview: () => adminFetch("/api/admin/stats/overview"),
  occupancy: () => adminFetch("/api/admin/stats/occupancy"),
  revenue: (days = 14) => adminFetch("/api/admin/stats/revenue", { query: { days } }),
  bookingsPerDay: (days = 14) =>
    adminFetch("/api/admin/stats/bookings-per-day", { query: { days } }),
  vehicleTypes: () => adminFetch("/api/admin/stats/vehicle-types"),
  peakHours: () => adminFetch("/api/admin/stats/peak-hours"),
  recentHistory: (limit = 10) =>
    adminFetch("/api/admin/stats/recent-history", { query: { limit } }),

  latestPayments: (limit = 20) =>
    adminFetch("/api/admin/payments/latest", { query: { limit } }),

  listBookings: (q) => adminFetch("/api/admin/bookings", { query: q }),
  getBooking: (id) => adminFetch(`/api/admin/bookings/${id}`),
  reassignSlot: (id, payload) =>
    adminFetch(`/api/admin/bookings/${id}/slot`, { method: "PATCH", body: payload }),

  listSlots: () => adminFetch("/api/admin/slots"),
  updateSlot: (id, payload) =>
    adminFetch(`/api/admin/slots/${id}`, { method: "PATCH", body: payload }),
};
