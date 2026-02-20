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
    if (!token) return;

    closed.current = false;

    const connect = () => {
      const ws = new WebSocket(wsUrlForBooking(bookingId, token));
      wsRef.current = ws;

      ws.onopen = () => setTracking((t) => ({ ...t, connected: true }));
      ws.onclose = () => {
        setTracking((t) => ({ ...t, connected: false }));
        if (!closed.current) setTimeout(connect, 1500);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "tracking_state" || msg.type === "tracking_update") {
            setTracking({
              connected: true,
              driverArrived: !!msg.driverArrived,
              slotOccupied: !!msg.slotOccupied,
            });
          }
        } catch {}
      };
    };

    connect();

    return () => {
      closed.current = true;
      try { wsRef.current?.close(); } catch {}
    };
  }, [bookingId]);

  return tracking;
}