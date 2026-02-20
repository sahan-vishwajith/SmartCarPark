export function wsUrlForBooking(bookingId, token) {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const host = import.meta.env.VITE_WS_HOST || window.location.host;
  // if backend is different: set VITE_WS_HOST=localhost:5000

  const u = new URL(`${proto}://${host}/ws/bookings/${bookingId}`);
  u.searchParams.set("token", token);
  return u.toString();
}