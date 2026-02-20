// src/hooks/useLatestBooking.js
import { useEffect, useState } from "react";
import { APP_EVENTS } from "../lib/appEvents";
import { STORAGE_KEYS } from "../lib/storageKeys";

export function useLatestBooking() {
  const [latestBookingId, setLatestBookingId] = useState(
    localStorage.getItem(STORAGE_KEYS.LATEST_BOOKING_ID)
  );

  useEffect(() => {
    const sync = () => {
      setLatestBookingId(localStorage.getItem(STORAGE_KEYS.LATEST_BOOKING_ID));
    };

    window.addEventListener("storage", sync);
    window.addEventListener(APP_EVENTS.BOOKING_CHANGED, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(APP_EVENTS.BOOKING_CHANGED, sync);
    };
  }, []);

  return { latestBookingId };
}