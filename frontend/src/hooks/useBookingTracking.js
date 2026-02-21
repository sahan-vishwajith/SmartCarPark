import { useEffect, useRef, useState } from "react";
import { getToken } from "../lib/auth";
import { wsUrlForBooking } from "../lib/ws";

export function useBookingTracking(bookingId) {
  const [tracking, setTracking] = useState({
    connected: false,
    driverArrived: false,
    slotOccupied: false,
  });

  const wsRef = useRef(null);
  const closed = useRef(false);

  useEffect(() => {
    if (!bookingId) return;

    const token = getToken();
    if (!token) {
      console.warn("[WS] No token found. Tracking disabled.");
      return;
    }

    closed.current = false;

    const connect = () => {
      const url = wsUrlForBooking(bookingId, token);
      console.log("[WS] Connecting...", { bookingId, url });

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] Connected ✅", { bookingId });
        setTracking((t) => ({ ...t, connected: true }));
      };

      ws.onclose = (e) => {
        console.warn("[WS] Closed ❌", {
          bookingId,
          code: e.code,
          reason: e.reason,
          wasClean: e.wasClean,
        });

        setTracking((t) => ({ ...t, connected: false }));

        if (!closed.current) {
          console.log("[WS] Reconnecting in 1500ms...");
          setTimeout(connect, 1500);
        } else {
          console.log("[WS] Closed by user cleanup.");
        }
      };

      ws.onerror = (e) => {
        console.error("[WS] Error ⚠️", { bookingId, event: e });
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          console.log("[WS] Message ⬇️", msg);

          if (msg.type === "tracking_state" || msg.type === "tracking_update") {
            setTracking({
              connected: true,
              driverArrived: !!msg.driverArrived,
              slotOccupied: !!msg.slotOccupied,
            });
          } else if (msg.type === "error") {
            console.error("[WS] Server error:", msg.message);
          }
        } catch (err) {
          console.warn("[WS] Non-JSON message:", e.data);
        }
      };
    };

    connect();

    return () => {
      closed.current = true;
      console.log("[WS] Cleanup: closing socket", { bookingId });
      try {
        wsRef.current?.close();
      } catch (e) {
        console.warn("[WS] Cleanup close failed", e);
      }
    };
  }, [bookingId]);

  return tracking;
}