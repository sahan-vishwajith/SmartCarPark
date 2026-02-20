import { useState } from "react";

export default function PrebookDateTimeModal({ onClose, onNext }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("09:00");

  const handleContinue = () => {
    if (!date || !startTime) return alert("Please select a date and start time.");
    onNext(date, startTime);
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