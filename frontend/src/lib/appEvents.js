// src/lib/appEvents.js
export const APP_EVENTS = {
  AUTH_CHANGED: "auth-changed",
  BOOKING_CHANGED: "booking-changed",
};

export function emitAppEvent(name) {
  window.dispatchEvent(new Event(name));
}