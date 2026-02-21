import { useMemo, useState } from "react";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { APP_EVENTS, emitAppEvent } from "../../lib/appEvents";
import { toUtcIso } from "../../lib/time";

export default function PaymentModal({ bookingDraft, onClose, onBack, onSuccess }) {
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Ensure we always send correct UTC ISO to backend
  const startTimeUtcIso = useMemo(() => {
    return (
      bookingDraft?.startTimeUtcIso ||
      toUtcIso(bookingDraft?.date, bookingDraft?.startTime)
    );
  }, [bookingDraft?.startTimeUtcIso, bookingDraft?.date, bookingDraft?.startTime]);

  const confirmPayment = async () => {
    if (!cardName || !cardNumber || !expiry || !cvv) {
      alert("Please fill all payment details.");
      return;
    }

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      alert("Please login first to pre-book a slot.");
      return;
    }

    if (!bookingDraft?.date || !bookingDraft?.startTime) {
      alert("Missing booking date/time. Please go back and select again.");
      return;
    }

    if (!startTimeUtcIso) {
      alert("Invalid booking time. Please go back and select again.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        // Keep date + local time for your backend/UI logs (optional)
        date: bookingDraft.date,
        startTimeLocal: bookingDraft.startTime,

        // ✅ THIS is what backend must store/use
        startTime: startTimeUtcIso,

        payment: { cardName, cardNumber, expiry, cvv },
      };

      const res = await fetch("http://localhost:5000/api/prebook-confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data.message || data.error || "Sorry, payment or booking could not be completed.");
        return;
      }

      if (!data.slotId || !data.bookingId) {
        alert("Backend did not return bookingId/slotId. Please check your API.");
        return;
      }

      // ✅ SAVE booking id for Tracking
      localStorage.setItem(STORAGE_KEYS.LATEST_BOOKING_ID, data.bookingId);
      emitAppEvent(APP_EVENTS.BOOKING_CHANGED);

      // ✅ Pass startAt ISO forward so BookingPage can show correct local time from ISO
      onSuccess({
        bookingId: data.bookingId,
        slotId: data.slotId,
        startAt: data.startTime || startTimeUtcIso, // prefer backend returned ISO if provided
        date: bookingDraft.date, // kept for fallback display
        startTime: bookingDraft.startTime, // kept for fallback display
      });
    } catch (err) {
      console.error(err);
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalCard"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="modalTitle">Payment Details</h2>

        <div className="modalBody">
          <p className="modalSummaryText">
            Booking for <strong>{bookingDraft.date}</strong> at{" "}
            <strong>{bookingDraft.startTime}</strong>
          </p>

          <div className="formGrid">
            <div className="field">
              <label className="fieldLabel">Name on Card</label>
              <input
                className="input"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label className="fieldLabel">Card Number</label>
              <input
                className="input"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="fieldRow">
              <div className="field">
                <label className="fieldLabel">Expiry</label>
                <input
                  className="input"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="MM/YY"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label className="fieldLabel">CVV</label>
                <input
                  className="input"
                  type="password"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  placeholder="•••"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="noteBox">
            For demo purposes this payment form is not charging real cards.
          </div>
        </div>

        <div className="modalActions">
          <button className="secondaryBtn modalBtn" onClick={onBack} disabled={loading}>
            Back
          </button>
          <button className="primaryBtn modalBtn" onClick={confirmPayment} disabled={loading}>
            {loading ? "Processing..." : "Confirm & Reserve Slot"}
          </button>
        </div>
      </div>
    </div>
  );
}