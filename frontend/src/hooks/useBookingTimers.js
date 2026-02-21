// src/hooks/useBookingTimers.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "./useNow";
import { safeDate } from "../lib/time";
import { PRICING, calcAmountLkr } from "../lib/pricing";

export function useBookingTimers(booking, tracking) {
  const now = useNow(1000);

  const startAt = useMemo(() => {
    if (!booking) return null;
    return safeDate(booking.startAt);
  }, [booking]);

  const startMs = startAt ? startAt.getTime() : null;
  const msToStart = startMs == null ? null : startMs - now;
  const hasStarted = startMs != null && msToStart <= 0;

  // track occupied/vacated
  const [occupiedAt, setOccupiedAt] = useState(null);
  const [vacatedAt, setVacatedAt] = useState(null);
  const prevOccupiedRef = useRef(false);

  useEffect(() => {
    const occupied = Boolean(tracking?.slotOccupied);

    if (occupied && !prevOccupiedRef.current) {
      setOccupiedAt((prev) => prev || new Date(now));
      setVacatedAt(null);
    }

    if (!occupied && prevOccupiedRef.current) {
      setVacatedAt(new Date(now));
    }

    prevOccupiedRef.current = occupied;
  }, [tracking?.slotOccupied, now]);

  const everOccupied = useMemo(() => Boolean(occupiedAt), [occupiedAt]);

  // billing start: when booking started (or when occupied if later)
  const billStartMs = useMemo(() => {
    if (!startMs) return null;
    const occ = occupiedAt ? occupiedAt.getTime() : null;
    if (!occ) return startMs;
    return Math.max(startMs, occ);
  }, [startMs, occupiedAt]);

  const parkedMsLive = useMemo(() => {
    if (!hasStarted || !billStartMs) return 0;
    // if vacated, stop at vacatedAt else keep running
    const end = vacatedAt ? vacatedAt.getTime() : now;
    return Math.max(0, end - billStartMs);
  }, [hasStarted, billStartMs, vacatedAt, now]);

  const minutesParked = useMemo(() => parkedMsLive / 60000, [parkedMsLive]);

  const amountLkr = useMemo(() => {
    if (!hasStarted) return PRICING.baseFee; // show precharge once booked
    return calcAmountLkr({ minutesParked });
  }, [hasStarted, minutesParked]);

  return {
    now,
    startAt,
    hasStarted,
    msToStart,
    occupiedAt,
    vacatedAt,
    everOccupied,
    parkedMsLive,
    minutesParked,
    amountLkr,
  };
}