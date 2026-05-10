import { useEffect, useState } from "react";
import { adminApi } from "../adminApi";

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError("");
    try {
      setLoading(true);
      const data = await adminApi.listSlots();
      setSlots(data.items || []);
    } catch (err) {
      setError(err.message || "Failed to load slots");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (slot) => {
    const next = !slot.isActive;
    if (!next) {
      const ok = window.confirm(
        `Deactivate ${slot.label}? Existing CONFIRMED bookings on this slot will not be cancelled, but no new bookings can be assigned to it.`
      );
      if (!ok) return;
    }
    try {
      setBusyId(slot.id);
      await adminApi.updateSlot(slot.id, { isActive: next });
      await load();
    } catch (err) {
      alert(err.message || "Failed to update slot");
    } finally {
      setBusyId(null);
    }
  };

  const counts = slots.reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    },
    { FREE: 0, OCCUPIED: 0, RESERVED: 0, INACTIVE: 0 }
  );

  return (
    <div>
      <div className="spaceBetween">
        <div>
          <h1 className="adminPageTitle">Slots</h1>
          <p className="adminPageSubtitle">
            Free {counts.FREE} · Reserved {counts.RESERVED} · Occupied {counts.OCCUPIED} · Inactive {counts.INACTIVE}
          </p>
        </div>
        <button className="adminBtnSm" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <div className="adminError">{error}</div>}

      <div className="adminGrid2" style={{ gridTemplateColumns: "1fr 360px" }}>
        <div className="adminCard">
          <div className="adminCardTitle">Live map (click a slot to toggle active)</div>
          <div className="slotMap">
            {slots.map((s) => (
              <button
                key={s.id}
                className={`slotCell ${s.status}`}
                title={`${s.label} · ${s.status}${s.currentBookingId ? " · booking #" + s.currentBookingId : ""}`}
                onClick={() => toggleActive(s)}
                disabled={busyId === s.id}
                style={{ border: "1px solid #1f2937" }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="legend">
            <span><span className="dot dot-FREE" />Free</span>
            <span><span className="dot dot-RESERVED" />Reserved</span>
            <span><span className="dot dot-OCCUPIED" />Occupied</span>
            <span><span className="dot dot-INACTIVE" />Inactive</span>
          </div>
        </div>

        <div className="adminCard" style={{ padding: 0, overflow: "hidden" }}>
          <table className="adminTable">
            <thead>
              <tr>
                <th>Label</th>
                <th>Status</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.label}</strong></td>
                  <td><span className={`pill pill-${s.status}`}>{s.status}</span></td>
                  <td>{s.isActive ? "Yes" : "No"}</td>
                  <td className="right">
                    <button
                      className="adminBtnSm"
                      onClick={() => toggleActive(s)}
                      disabled={busyId === s.id}
                    >
                      {s.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {!slots.length && (
                <tr><td colSpan="4" className="muted" style={{ textAlign: "center", padding: 16 }}>No slots.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
