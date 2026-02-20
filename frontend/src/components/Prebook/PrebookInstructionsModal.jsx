export default function PrebookInstructionsModal({ onClose, onContinue }) {
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <h2 className="modalTitle">Before you Pre-book</h2>

        <div className="modalBody">
          <ol className="stepsList">
            <li>Select your parking date and start time.</li>
            <li>Enter your payment details to confirm.</li>
            <li>We&apos;ll assign you a parking slot immediately.</li>
            <li>Your reserved slot will be highlighted on the map.</li>
          </ol>

          <div className="noteBox">
            <strong>Note:</strong> Please arrive on time.
          </div>
        </div>

        <div className="modalActions">
          <button className="secondaryBtn modalBtn" onClick={onClose}>
            Cancel
          </button>
          <button className="primaryBtn modalBtn" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}