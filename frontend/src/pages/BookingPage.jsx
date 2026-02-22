// src/pages/BookingPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ParkingMap from "../components/ParkingMap";
import { apiFetch } from "../lib/api";
import { getToken } from "../lib/auth";
import { useBookingTracking } from "../hooks/useBookingTracking";
import { useBookingTimers } from "../hooks/useBookingTimers";
import { formatCountdown, formatDuration, formatLocalDateTime } from "../lib/time";
import { PRICING } from "../lib/pricing";

const checkoutKey = (bookingId) => `checkoutAt:${bookingId}`;
const thankYouKey = (bookingId) => `thankYouShown:${bookingId}`;

function ThankYouModal({ open, onContinue }) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: 18,
          padding: "18px 16px",
          background: "rgba(18, 24, 38, 0.92)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
        <h2 style={{ margin: "0 0 6px 0", fontSize: 20, color: "rgba(255,255,255,0.95)" }}>
          Thank you!
        </h2>
        <p style={{ margin: "0 0 14px 0", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
          Your parking session is completed. Drive safe and see you again.
        </p>

        <button className="primaryBtn" style={{ width: "100%" }} onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default function BookingPage() {
  const { bookingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(location.state || null);
  const tracking = useBookingTracking(bookingId);

  // ✅ persisted checkout state
  const [checkedOutAt, setCheckedOutAt] = useState(() => {
    const raw = localStorage.getItem(checkoutKey(bookingId));
    return raw ? new Date(raw) : null;
  });

  useEffect(() => {
    if (booking) return;

    const token = getToken();
    if (!token) return;

    apiFetch(`/api/bookings/${bookingId}`, { token })
      .then((data) => {
        setBooking({
          bookingId: data.id,
          slotId: data.slotId,
          startAt: data.startTime, // ISO Z from backend
        });
      })
      .catch(() => {});
  }, [booking, bookingId]);

  const timers = useBookingTimers(booking, tracking);
  const displayStart = useMemo(() => formatLocalDateTime(timers.startAt), [timers.startAt]);
  const checkedOut = Boolean(checkedOutAt);

  // ✅ Exit countdown after checkout (15 mins)
  const exitDeadlineMs = useMemo(() => {
    if (!checkedOutAt) return null;
    return checkedOutAt.getTime() + PRICING.exitGraceMinutes * 60 * 1000;
  }, [checkedOutAt]);

  const msToExit = useMemo(() => {
    if (!exitDeadlineMs) return null;
    return exitDeadlineMs - timers.now;
  }, [exitDeadlineMs, timers.now]);

  // ✅ freeze final amount at checkout
  const [finalAmount, setFinalAmount] = useState(null);

  useEffect(() => {
    if (!checkedOut) return;
    if (finalAmount != null) return;
    setFinalAmount(timers.amountLkr);
  }, [checkedOut, finalAmount, timers.amountLkr]);

  const handleCheckout = () => {
    if (!timers.hasStarted) return;

    const t = new Date(timers.now).toISOString();
    localStorage.setItem(checkoutKey(bookingId), t);
    setCheckedOutAt(new Date(t));
    setFinalAmount(timers.amountLkr);
  };

  /**
   * ✅ Navigation rules (final):
   * - Always show ENTRANCE/EXIT markers (inside ParkingMap)
   * - Show route to SLOT only after driverArrived=true AND slotOccupied=false
   * - Hide route to SLOT once slotOccupied=true (already parked)
   * - Show route to EXIT after checkout OR after occupied->vacated
   */
  const navigation = useMemo(() => {
    const slotOccupied = Boolean(tracking?.slotOccupied);
    const driverArrived = Boolean(tracking?.driverArrived);

    // Exit route after checkout OR after occupied->vacated
    const shouldExit = checkedOut || (timers.everOccupied && !slotOccupied);
    if (shouldExit) {
      return { show: true, mode: "TO_EXIT", color: "#4dabf7" };
    }

    // Already parked -> hide entrance→slot route
    if (slotOccupied) {
      return { show: false, mode: "TO_SLOT" };
    }

    // Before driver arrives -> hide route
    if (!driverArrived) {
      return { show: false, mode: "TO_SLOT" };
    }

    // Arrived but not parked -> show entrance→slot route
    return { show: true, mode: "TO_SLOT", color: "#ff4d4f" };
  }, [checkedOut, timers.everOccupied, tracking?.slotOccupied, tracking?.driverArrived]);

  // ✅ Thank-you popup when driver leaves:
  // Trigger once when:
  // - driverArrived was true at least once
  // - now driverArrived=false AND slotOccupied=false
  // - and we consider the session actually happened (checkedOut OR everOccupied)
  const [showThankYou, setShowThankYou] = useState(false);
  const everArrivedRef = useRef(false);

  useEffect(() => {
    const alreadyShown = localStorage.getItem(thankYouKey(bookingId)) === "1";
    if (alreadyShown) return;

    const driverArrived = Boolean(tracking?.driverArrived);
    const slotOccupied = Boolean(tracking?.slotOccupied);

    if (driverArrived) everArrivedRef.current = true;

    const leftParking =
      everArrivedRef.current &&
      !driverArrived &&
      !slotOccupied &&
      (checkedOut || timers.everOccupied);

    if (leftParking) {
      setShowThankYou(true);
    }
  }, [bookingId, tracking?.driverArrived, tracking?.slotOccupied, checkedOut, timers.everOccupied]);

  const handleThankYouContinue = () => {
    try {
      localStorage.setItem(thankYouKey(bookingId), "1");
      localStorage.removeItem(checkoutKey(bookingId));
    } catch {}

    setShowThankYou(false);
    navigate("/", { replace: true }); // ✅ home page
  };

  if (!booking)
    return (
      <div className="bookingPage">
        <p>Loading your booking...</p>
      </div>
    );

  return (
    <div className="bookingPage">
      <ThankYouModal open={showThankYou} onContinue={handleThankYouContinue} />

      <div className="bookingCard">
        <h1 className="bookingTitle">Booking Confirmed</h1>

        <p className="bookingSubtitle">
          Your slot <strong>{booking.slotId}</strong> is reserved for{" "}
          <strong>{displayStart.date}</strong> at <strong>{displayStart.time}</strong>.
        </p>

        {/* ✅ Timers + Pricing */}
        <div className="timerGrid">
          {!timers.hasStarted ? (
            <div className="timerBox">
              <div className="timerLabel">Starts In</div>
              <div className="timerValue">
                {timers.msToStart == null ? "-" : formatCountdown(timers.msToStart)}
              </div>
              <div className="timerHint">
                Precharge included: <strong>LKR {PRICING.baseFee}</strong>
              </div>
            </div>
          ) : (
            <div className="timerBox">
              <div className="timerLabel">On Slot</div>
              <div className="timerValue">{formatDuration(timers.parkedMsLive)}</div>
              <div className="timerHint">
                Precharge included: <strong>LKR {PRICING.baseFee}</strong>
              </div>
            </div>
          )}

          <div className="timerBox">
            <div className="timerLabel">{checkedOut ? "Final Amount" : "Current Amount"}</div>
            <div className="timerValue">
              LKR {(checkedOut ? finalAmount ?? timers.amountLkr : timers.amountLkr).toLocaleString()}
            </div>
            <div className="timerHint">
              Rate: <strong>LKR {PRICING.perMinute}/min</strong>
            </div>
          </div>
        </div>

        {/* ✅ Checkout */}
        {timers.hasStarted && !checkedOut && (
          <div style={{ marginTop: 10 }}>
            <button className="primaryBtn" onClick={handleCheckout}>
              Checkout
            </button>
            <div className="noteBox" style={{ marginTop: 10 }}>
              Click Checkout when you are leaving. Then we will show the route to the exit.
            </div>
          </div>
        )}

        {/* ✅ After checkout: exit countdown */}
        {checkedOut && (
          <div className="noteBox" style={{ marginTop: 12 }}>
            Checkout completed ✅ <br />
            Exit within:{" "}
            <strong>{msToExit == null ? "-" : msToExit <= 0 ? "00:00" : formatCountdown(msToExit)}</strong>
          </div>
        )}

        <div className="noteBox" style={{ marginTop: 12 }}>
          {tracking?.connected ? "Live tracking connected ✅" : "Connecting live tracking…"}
          <br />
          Driver arrived: <strong>{String(Boolean(tracking?.driverArrived))}</strong> | Slot occupied:{" "}
          <strong>{String(Boolean(tracking?.slotOccupied))}</strong>
          {!Boolean(tracking?.driverArrived) && !Boolean(tracking?.slotOccupied) && (
            <>
              <br />
              Navigation appears after arrival (and hides once parked) ✅
            </>
          )}
        </div>

        <section className="bookingMapSection">
          <div className="summaryMap">
            <ParkingMap
              selectedSlotLabel={booking.slotId}
              interactive={false}
              tracking={tracking}
              navigation={navigation}
            />
          </div>
        </section>
      </div>
    </div>
  );
}