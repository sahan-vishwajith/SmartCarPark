import { useMemo, useState } from "react";
import { toUtcIso } from "../../lib/time";

function getLocalDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PrebookDateTimeModal({ onClose, onNext }) {
  // ✅ use LOCAL date (not UTC)
  const [date, setDate] = useState(() => getLocalDateStr());
  const [startTime, setStartTime] = useState("09:00");

  // ✅ compute correct UTC ISO for backend storage
  const startTimeUtcIso = useMemo(() => toUtcIso(date, startTime), [date, startTime]);

  const handleContinue = () => {
    if (!date || !startTime) {
      alert("Please select a date and start time.");
      return;
    }
    if (!startTimeUtcIso) {
      alert("Invalid date/time.");
      return;
    }

    // ✅ pass both local inputs + UTC ISO
    // Best practice: the next step should POST startTimeUtcIso to backend
    onNext(date, startTime, startTimeUtcIso);
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <h2 className="modalTitle">Select Date &amp; Start Time</h2>

        <div className="modalBody">
          <div className="formGrid">
            <div className="field">
              <label className="fieldLabel">Date</label>
              <input
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="field">
              <label className="fieldLabel">Start Time</label>
              <input
                className="input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="noteBox">
            We&apos;ll assign you a parking slot after payment.
            {/* Optional debug (remove later) */}
            {/* <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              UTC ISO: {startTimeUtcIso}
            </div> */}
          </div>
        </div>

        <div className="modalActions">
          <button className="secondaryBtn modalBtn" onClick={onClose}>
            Cancel
          </button>
          <button className="primaryBtn modalBtn" onClick={handleContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}