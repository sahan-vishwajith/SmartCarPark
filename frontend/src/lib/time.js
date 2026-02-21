// src/lib/time.js

export function safeDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Convert LOCAL (picked by user) date+time -> UTC ISO string (…Z)
 */
export function toUtcIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const local = new Date(y, m - 1, d, hh, mm, 0);
  return local.toISOString();
}

export function localDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return safeDate(new Date(y, m - 1, d, hh, mm, 0));
}

export function formatCountdown(ms) {
  const abs = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(abs / 1000);

  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);

  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ✅ always show HH:MM:SS for parked duration
export function formatDuration(ms) {
  const abs = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(abs / 1000);

  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);

  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatLocalDateTime(dateOrIso) {
  const d = safeDate(dateOrIso);
  if (!d) return { date: "-", time: "-" };

  const dateStr = d.toLocaleDateString("en-CA");
  const timeStr = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return { date: dateStr, time: timeStr };
}