import React from "react";
import "./ThankYouModal.css";

export default function ThankYouModal({ open, onContinue }) {
  if (!open) return null;

  return (
    <div className="tyOverlay" role="dialog" aria-modal="true">
      <div className="tyCard">
        <div className="tyIcon">✅</div>
        <h2 className="tyTitle">Thank you!</h2>
        <p className="tyText">
          Your parking session is completed. Drive safe and see you again.
        </p>

        <button className="primaryBtn tyBtn" onClick={onContinue}>
          Continue
        </button>
      </div>
    </div>
  );
}