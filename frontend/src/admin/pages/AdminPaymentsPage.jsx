import { useEffect, useState } from "react";
import { adminApi } from "../adminApi";

function fmtMoney(n, currency = "LKR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}

export default function AdminPaymentsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      setLoading(true);
      const data = await adminApi.latestPayments(30);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const latest = items[0];

  return (
    <div>
      <div className="spaceBetween">
        <div>
          <h1 className="adminPageTitle">Payments</h1>
          <p className="adminPageSubtitle">
            Live feed of payments, with the parking summary for each transaction.
          </p>
        </div>
        <button className="adminBtnSm" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className="adminError">{error}</div>}

      {/* "After payment happens, admin should see a summary of that vehicle's parking" */}
      {latest && (
        <div className="adminCard" style={{ marginBottom: 16, borderColor: "#fbbf24", boxShadow: "0 10px 28px rgba(251, 191, 36, 0.18)" }}>
          <div className="adminCardTitle">Most recent payment — vehicle parking summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <div className="smallText">Vehicle</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {latest.vehicle?.vehicleNumber || "—"}
              </div>
              <div className="smallText">{latest.vehicle?.driverName || "—"}</div>
              <div className="smallText">{latest.vehicle?.vehicleType || ""}</div>
              <div className="smallText">{latest.vehicle?.phoneNumber || ""}</div>
            </div>
            <div>
              <div className="smallText">Slot</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                {latest.slot?.label || "—"}
              </div>
              <div className="smallText">
                Booking #{latest.booking?.id} · <span className={`pill pill-${latest.booking?.status}`}>{latest.booking?.status}</span>
              </div>
              <div className="smallText">
                {fmtDate(latest.booking?.startTime)} → {latest.booking?.endTime ? new Date(latest.booking.endTime).toLocaleTimeString() : ""}
              </div>
              <div className="smallText">
                {latest.booking?.driverArrived ? "✓ Arrived" : "Awaiting arrival"}
                {latest.booking?.slotOccupied ? " · ✓ Occupied" : ""}
              </div>
            </div>
            <div>
              <div className="smallText">Payment</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>
                {fmtMoney(latest.payment?.amount, latest.payment?.currency)}
              </div>
              <div className="smallText">
                {latest.payment?.method} · <span className={`pill pill-${latest.payment?.status}`}>{latest.payment?.status}</span>
              </div>
              <div className="smallText">
                {latest.payment?.cardHolder ? `${latest.payment.cardHolder} ` : ""}
                {latest.payment?.cardLast4 ? `**** ${latest.payment.cardLast4}` : ""}
              </div>
              <div className="smallText">{fmtDate(latest.payment?.paidAt)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="adminCard" style={{ padding: 0, overflow: "hidden" }}>
        <table className="adminTable">
          <thead>
            <tr>
              <th>Paid at</th>
              <th>Booking</th>
              <th>Vehicle</th>
              <th>Slot</th>
              <th>Method</th>
              <th>Status</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.payment?.id}>
                <td className="smallText">{fmtDate(it.payment?.paidAt)}</td>
                <td>#{it.booking?.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{it.vehicle?.vehicleNumber || "—"}</div>
                  <div className="smallText">{it.vehicle?.driverName || "—"}</div>
                </td>
                <td>{it.slot?.label || "—"}</td>
                <td>
                  {it.payment?.method}
                  {it.payment?.cardLast4 ? <div className="smallText">**** {it.payment.cardLast4}</div> : null}
                </td>
                <td><span className={`pill pill-${it.payment?.status}`}>{it.payment?.status}</span></td>
                <td className="right" style={{ fontWeight: 600 }}>
                  {fmtMoney(it.payment?.amount, it.payment?.currency)}
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan="7" className="muted" style={{ textAlign: "center", padding: 18 }}>No payments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
