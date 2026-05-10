import { useState } from "react";
import { STORAGE_KEYS } from "../../lib/storageKeys";

/**
 * Shown when the user clicks "Checkout" on the BookingPage.
 * Collects card details and POSTs the actual payment to /api/payments
 * (booking is already confirmed; this is the only place a payment row is created).
 *
 * Props:
 *   bookingId   - id of the booking being paid for
 *   amountLkr   - total amount to charge (already includes base fee + per-minute)
 *   slotLabel   - optional, just for display
 *   onClose     - dismiss without paying
 *   onSuccess   - called with the payment summary { payment, booking, slot, vehicle }
 */
export default function CheckoutPaymentModal({
  bookingId,
  amountLkr,
  slotLabel,
  onClose,
  onSuccess,
}) {
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!cardName || !cardNumber || !expiry || !cvv) {
      alert("Please fill all payment details.");
      return;
    }

    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      alert("Please login first.");
      return;
    }

    if (!bookingId) {
      alert("Missing booking. Please reload the page and try again.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("http://localhost:5000/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          amount: Number(amountLkr) || 0,
          currency: "LKR",
          method: "CARD",
          card: { cardName, cardNumber },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message || data.error || "Payment failed. Please try again.");
        return;
      }

      onSuccess({
        bookingId,
        amountLkr: Number(amountLkr) || 0,
        paymentSummary: data,
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
        <h2 className="modalTitle">Pay & Checkout</h2>

        <div className="modalBody">
          <p className="modalSummaryText">
            {slotLabel ? (
              <>
                Slot <strong>{slotLabel}</strong> · Booking{" "}
                <strong>#{bookingId}</strong>
              </>
            ) : (
              <>Booking <strong>#{bookingId}</strong></>
            )}
          </p>

          <div
            className="noteBox"
            style={{
              fontSize: 18,
              fontWeight: 700,
              textAlign: "center",
              padding: "14px 12px",
              marginBottom: 12,
            }}
          >
            Total: LKR {Number(amountLkr || 0).toLocaleString()}
          </div>

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
          <button className="secondaryBtn modalBtn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="primaryBtn modalBtn" onClick={submit} disabled={loading}>
            {loading ? "Processing..." : `Pay LKR ${Number(amountLkr || 0).toLocaleString()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
