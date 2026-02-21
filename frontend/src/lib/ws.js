export function wsUrlForBooking(bookingId, token) {
  // Backend base URL (set in .env). Fallback to Flask dev port.
  const backendHttp =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const backendWs = backendHttp.replace(/^http/, "ws");

  const u = new URL(`${backendWs}/ws/bookings/${bookingId}`);
  u.searchParams.set("token", token);
  return u.toString();
}