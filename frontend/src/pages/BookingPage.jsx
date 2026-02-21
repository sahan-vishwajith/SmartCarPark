// src/pages/BookingPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import ParkingMap from "../components/ParkingMap";
import { apiFetch } from "../lib/api";
import { getToken } from "../lib/auth";
import { useBookingTracking } from "../hooks/useBookingTracking";
import { useBookingTimers } from "../hooks/useBookingTimers";
import { formatCountdown, formatDuration, formatLocalDateTime } from "../lib/time";
import { PRICING } from "../lib/pricing";

const checkoutKey = (bookingId) => `checkoutAt:${bookingId}`;

export default function BookingPage() {
  const { bookingId } = useParams();
  const location = useLocation();
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
   * ✅ Navigation rules (updated):
   * - Always show ENTRANCE/EXIT markers (handled inside ParkingMap)
   * - Show route to SLOT only AFTER driverArrived = true
   * - Show route to EXIT after checkout OR after occupied->vacated
   */
  const navigation = useMemo(() => {
    const slotOccupied = Boolean(tracking?.slotOccupied);
    const driverArrived = Boolean(tracking?.driverArrived);

    const shouldExit = checkedOut || (timers.everOccupied && !slotOccupied);

    // ✅ after checkout/vacated: always show exit route
    if (shouldExit) {
      return { show: true, mode: "TO_EXIT", color: "#4dabf7" };
    }

    // ✅ before driver arrives: hide route (POIs still visible)
    if (!driverArrived) {
      return { show: false, mode: "TO_SLOT" };
    }

    // ✅ after driver arrives: show route to slot
    // You asked "after driverArrived becomes true", so we show it now.
    // (Color is red to indicate arrived; change to green if you prefer.)
    return { show: true, mode: "TO_SLOT", color: "#ff4d4f" };
  }, [checkedOut, timers.everOccupied, tracking?.slotOccupied, tracking?.driverArrived]);

  if (!booking)
    return (
      <div className="bookingPage">
        <p>Loading your booking...</p>
      </div>
    );

  return (
    <div className="bookingPage">
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
          {!Boolean(tracking?.driverArrived) && (
            <>
              <br />
              Navigation will appear after driver arrival ✅
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