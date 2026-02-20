import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [latestBookingId, setLatestBookingId] = useState(
    localStorage.getItem("latestBookingId")
  );
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const refresh = () => {
    setLatestBookingId(localStorage.getItem("latestBookingId"));
  };

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("booking-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("booking-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!latestBookingId) return null;

  return (
    <div className="notifBellWrapper" ref={panelRef}>
      <button
        className="notifBellButton"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        🔔
        <span className="notifBadge">1</span>
      </button>

      {open && (
        <div className="notifPanel">
          <div className="notifPanelHeader">Notifications</div>

          <div
            className="notifCard success notifNew"
            role="button"
            tabIndex={0}
            onClick={() => {
              setOpen(false);
              navigate(`/booking/${latestBookingId}`);
            }}
          >
            <div className="notifTitle">Booking Confirmed</div>
            <div className="notifBody">
              Tap to open your tracking map (Booking #{latestBookingId})
            </div>
            <div className="notifSub">Open tracking</div>
          </div>

          <button
            className="secondaryBtn"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              localStorage.removeItem("latestBookingId");
              window.dispatchEvent(new Event("booking-changed"));
              setOpen(false);
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}