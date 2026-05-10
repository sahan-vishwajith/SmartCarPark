import { useEffect, useState } from "react";
import { adminApi } from "../adminApi";

const STATUSES = ["", "CONFIRMED", "PENDING", "CANCELLED", "REJECTED"];

export default function AdminBookingsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [reassignFor, setReassignFor] = useState(null); // booking object
  const [slotInput, setSlotInput] = useState("");
  const [slotsList, setSlotsList] = useState([]);
  const [savingReassign, setSavingReassign] = useState(false);

  const load = async () => {
    setError("");
    try {
      setLoading(true);
      const data = await adminApi.listBookings({ q, status, limit: 50 });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const onSearch = (e) => {
    e.preventDefault();
    load();
  };

  const openReassign = async (b) => {
    setReassignFor(b);
    setSlotInput("");
    try {
      const data = await adminApi.listSlots();
      setSlotsList(data.items || []);
    } catch {
      setSlotsList([]);
    }
  };

  const submitReassign = async () => {
    if (!reassignFor) return;
    if (!slotInput) return;
    try {
      setSavingReassign(true);
      const isNumeric = /^\d+$/.test(slotInput.trim());
      const payload = isNumeric
        ? { slotId: Number(slotInput.trim()) }
        : { slotLabel: slotInput.trim() };
      await adminApi.reassignSlot(reassignFor.id, payload);
      setReassignFor(null);
      setSlotInput("");
      await load();
    } catch (err) {
      alert(err.message || "Failed to reassign slot");
    } finally {
      setSavingReassign(false);
    }
  };

  return (
    <div>
      <h1 className="adminPageTitle">Bookings</h1>
      <p className="adminPageSubtitle">{total} total</p>

      <form className="adminToolbar" onSubmit={onSearch}>
        <input
          className="adminInput"
          style={{ maxWidth: 320 }}
          placeholder="Search vehicle / driver / username"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="adminInput"
          style={{ maxWidth: 160 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
        <button className="adminBtn" type="submit" disabled={loading}>
          {loading ? "Loading…" : "Apply"}
        </button>
      </form>

      {error && <div className="adminError">{error}</div>}

      <div className="adminCard" style={{ padding: 0, overflow: "hidden" }}>
        <table className="adminTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Vehicle</th>
              <th>Driver</th>
              <th>Slot</th>
              <th>Window</th>
              <th>Status</th>
              <th>Tracking</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id}>
                <td>#{b.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{b.vehicle?.vehicleNumber || "—"}</div>
                  <div className="smallText">{b.vehicle?.vehicleType || "—"}</div>
                </td>
                <td>
                  {b.vehicle?.driverName || "—"}
                  <div className="smallText">{b.vehicle?.username || ""}</div>
                </td>
                <td>{b.slotLabel || "—"}</td>
                <td className="smallText">
                  {b.startTime ? new Date(b.startTime).toLocaleString() : "—"}
                  <br />
                  {b.endTime ? `→ ${new Date(b.endTime).toLocaleTimeString()}` : ""}
                </td>
                <td><span className={`pill pill-${b.status}`}>{b.status}</span></td>
                <td className="smallText">
                  {b.driverArrived ? "Arrived" : "Not arrived"}
                  <br />
                  {b.slotOccupied ? "Slot occupied" : ""}
                </td>
                <td className="right">
                  <button className="adminBtnSm" onClick={() => openReassign(b)}>
                    Reassign slot
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan="8" className="muted" style={{ textAlign: "center", padding: 18 }}>
                  No bookings match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reassignFor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setReassignFor(null)}
        >
          <div
            className="adminCard"
            style={{ width: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adminCardTitle">Reassign slot — booking #{reassignFor.id}</div>
            <p className="smallText" style={{ marginBottom: 10 }}>
              Currently: <strong>{reassignFor.slotLabel || "(none)"}</strong> ·{" "}
              vehicle <strong>{reassignFor.vehicle?.vehicleNumber || "—"}</strong>
            </p>

            <div className="adminLoginField">
              <label>New slot (label or id)</label>
              <input
                className="adminInput"
                placeholder="e.g. P12"
                value={slotInput}
                onChange={(e) => setSlotInput(e.target.value)}
                list="adminSlotLabels"
              />
              <datalist id="adminSlotLabels">
                {slotsList
                  .filter((s) => s.status !== "INACTIVE")
                  .map((s) => (
                    <option key={s.id} value={s.label} />
                  ))}
              </datalist>
              <p className="smallText" style={{ marginTop: 4 }}>
                Conflict-checked against other CONFIRMED bookings on the same window.
              </p>
            </div>

            <div className="spaceBetween" style={{ marginTop: 14 }}>
              <button className="adminBtnSm" onClick={() => setReassignFor(null)}>
                Cancel
              </button>
              <button className="adminBtn" onClick={submitReassign} disabled={savingReassign || !slotInput}>
                {savingReassign ? "Saving…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
