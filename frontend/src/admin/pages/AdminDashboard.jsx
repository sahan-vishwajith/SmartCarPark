import { useEffect, useState } from "react";
import { adminApi } from "../adminApi";
import { LineChart, StackedBar, Donut, Heatmap } from "../components/charts";

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("en-LK", { maximumFractionDigits: 0 });
}

function fmtMinutes(min) {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [perDay, setPerDay] = useState(null);
  const [vehicles, setVehicles] = useState(null);
  const [peak, setPeak] = useState(null);
  const [history, setHistory] = useState(null);
  const [occupancy, setOccupancy] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError("");
    try {
      setLoading(true);
      const [o, r, b, v, p, h, occ] = await Promise.all([
        adminApi.overview(),
        adminApi.revenue(14),
        adminApi.bookingsPerDay(14),
        adminApi.vehicleTypes(),
        adminApi.peakHours(),
        adminApi.recentHistory(8),
        adminApi.occupancy(),
      ]);
      setOverview(o);
      setRevenue(r);
      setPerDay(b);
      setVehicles(v);
      setPeak(p);
      setHistory(h);
      setOccupancy(occ);
    } catch (err) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <div className="spaceBetween">
        <div>
          <h1 className="adminPageTitle">Dashboard</h1>
          <p className="adminPageSubtitle">
            Live overview of bookings, revenue and slot occupancy.
            {overview?.asOf ? ` Refreshed ${new Date(overview.asOf).toLocaleTimeString()}.` : ""}
          </p>
        </div>
        <button className="adminBtnSm" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <div className="adminError">{error}</div>}

      {/* KPI cards */}
      <div className="adminKpiGrid">
        <div className="adminKpi">
          <div className="adminKpiLabel">Bookings (today)</div>
          <div className="adminKpiValue">{overview?.totals?.bookingsToday ?? "—"}</div>
          <div className="adminKpiSub">{overview?.totals?.bookings ?? 0} all-time</div>
        </div>
        <div className="adminKpi">
          <div className="adminKpiLabel">Revenue (7 days)</div>
          <div className="adminKpiValue">LKR {fmtMoney(overview?.revenue?.last7DaysLkr)}</div>
          <div className="adminKpiSub">LKR {fmtMoney(overview?.revenue?.last30DaysLkr)} last 30d</div>
        </div>
        <div className="adminKpi">
          <div className="adminKpiLabel">Slots in use</div>
          <div className="adminKpiValue">
            {(overview?.occupancyNow?.occupied ?? 0) + (overview?.occupancyNow?.reserved ?? 0)}
            <span className="muted" style={{ fontSize: 14 }}> / {overview?.totals?.activeSlots ?? 0}</span>
          </div>
          <div className="adminKpiSub">
            {overview?.occupancyNow?.occupied ?? 0} occupied · {overview?.occupancyNow?.reserved ?? 0} reserved
          </div>
        </div>
        <div className="adminKpi">
          <div className="adminKpiLabel">Avg. parking time</div>
          <div className="adminKpiValue">{fmtMinutes(history?.averageParkingMinutes)}</div>
          <div className="adminKpiSub">{history?.completedSessions ?? 0} sessions</div>
        </div>
      </div>

      {/* Row 1: Revenue + Vehicle types */}
      <div className="adminGrid2">
        <div className="adminCard">
          <div className="spaceBetween">
            <div className="adminCardTitle">Revenue (last 14 days, LKR)</div>
          </div>
          {revenue?.series?.length ? (
            <LineChart data={revenue.series} valueKey="amountLkr" labelKey="date" />
          ) : (
            <div className="muted">No revenue data yet.</div>
          )}
        </div>
        <div className="adminCard">
          <div className="adminCardTitle">Vehicle types</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Donut
              items={(vehicles?.items || []).map((v) => ({ label: v.type, value: v.count }))}
              size={180}
            />
            <div style={{ fontSize: 13, flex: 1 }}>
              {(vehicles?.items || []).slice(0, 6).map((v, i) => (
                <div key={i} className="spaceBetween" style={{ padding: "3px 0" }}>
                  <span>{v.type}</span>
                  <span className="muted">{v.count}</span>
                </div>
              ))}
              {!(vehicles?.items || []).length && <div className="muted">No vehicles yet.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Bookings per day + Live occupancy donut */}
      <div className="adminGrid2">
        <div className="adminCard">
          <div className="adminCardTitle">Bookings per day (by status)</div>
          {perDay?.series?.length ? (
            <StackedBar data={perDay.series} statuses={perDay.statuses} labelKey="date" />
          ) : (
            <div className="muted">No bookings yet.</div>
          )}
          <div className="legend">
            <span><span className="dot" style={{ background: "#fbbf24" }} />CONFIRMED</span>
            <span><span className="dot" style={{ background: "#3b82f6" }} />PENDING</span>
            <span><span className="dot" style={{ background: "#ef4444" }} />CANCELLED</span>
            <span><span className="dot" style={{ background: "#dc2626" }} />REJECTED</span>
          </div>
        </div>
        <div className="adminCard">
          <div className="adminCardTitle">Live slot occupancy</div>
          <Donut
            items={[
              { label: "Free",     value: overview?.occupancyNow?.free ?? 0,     color: "#fbbf24" },
              { label: "Reserved", value: overview?.occupancyNow?.reserved ?? 0, color: "#3b82f6" },
              { label: "Occupied", value: overview?.occupancyNow?.occupied ?? 0, color: "#dc2626" },
              { label: "Inactive", value: overview?.occupancyNow?.inactive ?? 0, color: "#94a3b8" },
            ]}
            size={180}
          />
          <div className="legend">
            <span><span className="dot dot-FREE" />Free</span>
            <span><span className="dot dot-RESERVED" />Reserved</span>
            <span><span className="dot dot-OCCUPIED" />Occupied</span>
            <span><span className="dot dot-INACTIVE" />Inactive</span>
          </div>
        </div>
      </div>

      {/* Row 3: Live slot map + Peak hours heatmap */}
      <div className="adminGrid2">
        <div className="adminCard">
          <div className="adminCardTitle">Live slot map</div>
          {occupancy?.items?.length ? (
            <div className="slotMap">
              {occupancy.items.map((s) => (
                <div key={s.id} className={`slotCell ${s.status}`} title={`${s.label} · ${s.status}`}>
                  {s.label}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No slots configured.</div>
          )}
        </div>

        <div className="adminCard">
          <div className="adminCardTitle">Peak hours (heatmap)</div>
          {peak?.matrix ? (
            <Heatmap
              matrix={peak.matrix}
              daysLabels={peak.daysLabels}
              hoursLabels={peak.hoursLabels}
            />
          ) : (
            <div className="muted">No data.</div>
          )}
        </div>
      </div>

      {/* Row 4: Recent history */}
      <div className="adminCard" style={{ marginTop: 16 }}>
        <div className="adminCardTitle">Latest parking history</div>
        <table className="adminTable">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Vehicle</th>
              <th>Slot</th>
              <th>Status</th>
              <th>Start</th>
              <th>End</th>
              <th className="right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {(history?.recent || []).map((r) => (
              <tr key={r.bookingId}>
                <td>#{r.bookingId}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.vehicleNumber || "—"}</div>
                  <div className="smallText">{r.driverName || "—"} · {r.vehicleType || "—"}</div>
                </td>
                <td>{r.slotLabel || "—"}</td>
                <td><span className={`pill pill-${r.status}`}>{r.status}</span></td>
                <td className="smallText">{r.startTime ? new Date(r.startTime).toLocaleString() : "—"}</td>
                <td className="smallText">{r.endTime ? new Date(r.endTime).toLocaleString() : "—"}</td>
                <td className="right">{fmtMinutes(r.durationMinutes)}</td>
              </tr>
            ))}
            {!(history?.recent || []).length && (
              <tr><td colSpan="7" className="muted" style={{ textAlign: "center", padding: 16 }}>No sessions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
