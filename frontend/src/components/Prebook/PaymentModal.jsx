import { useState } from "react";
import { STORAGE_KEYS } from "../../lib/storageKeys";
import { APP_EVENTS, emitAppEvent } from "../../lib/appEvents";

export default function PaymentModal({ bookingDraft, onClose, onBack, onSuccess }) {
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);

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

    try {
      setLoading(true);

      const payload = {
        date: bookingDraft.date,
        startTime: bookingDraft.startTime,
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
        alert(
          data.message || data.error || "Sorry, payment or booking could not be completed."
        );
        return;
      }

      if (!data.slotId || !data.bookingId) {
        alert("Backend did not return bookingId/slotId. Please check your API.");
        return;
      }

      // ✅ SAVE booking id for Tracking
      localStorage.setItem(STORAGE_KEYS.LATEST_BOOKING_ID, data.bookingId);
      emitAppEvent(APP_EVENTS.BOOKING_CHANGED);

      onSuccess({
        bookingId: data.bookingId,
        slotId: data.slotId,
        date: bookingDraft.date,
        startTime: bookingDraft.startTime,
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
      <div className="modalCard" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="modalTitle">Payment Details</h2>

        <div className="modalBody">
          <p className="modalSummaryText">
            Booking for <strong>{bookingDraft.date}</strong> at{" "}
            <strong>{bookingDraft.startTime}</strong>
          </p>

          <div className="formGrid">
            <div className="field">
              <label className="fieldLabel">Name on Card</label>
              <input className="input" value={cardName} onChange={(e) => setCardName(e.target.value)} />
            </div>

            <div className="field">
              <label className="fieldLabel">Card Number</label>
              <input className="input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
            </div>

            <div className="fieldRow">
              <div className="field">
                <label className="fieldLabel">Expiry</label>
                <input className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" />
              </div>
              <div className="field">
                <label className="fieldLabel">CVV</label>
                <input className="input" type="password" value={cvv} onChange={(e) => setCvv(e.target.value)} placeholder="•••" />
              </div>
            </div>
          </div>

          <div className="noteBox">For demo purposes this payment form is not charging real cards.</div>
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