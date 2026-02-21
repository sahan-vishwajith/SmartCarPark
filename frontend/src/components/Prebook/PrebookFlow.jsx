import { createContext, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PrebookInstructionsModal from "./PrebookInstructionsModal";
import PrebookDateTimeModal from "./PrebookDateTimeModal";
import PaymentModal from "./PaymentModal";

const PrebookCtx = createContext(null);

export function usePrebook() {
  const ctx = useContext(PrebookCtx);
  if (!ctx) throw new Error("usePrebook must be used inside <PrebookProvider>");
  return ctx;
}

/**
 * Provider: wraps the app so Navbar (or any component) can call usePrebook()
 */
export function PrebookProvider({ children }) {
  const [step, setStep] = useState("CLOSED"); // CLOSED | INSTRUCTIONS | PICKER | PAYMENT
  const [draft, setDraft] = useState(null); // { date, startTime, startTimeUtcIso }

  const api = useMemo(
    () => ({
      open: () => {
        setDraft(null);
        setStep("INSTRUCTIONS");
      },
      close: () => {
        setDraft(null);
        setStep("CLOSED");
      },
      // internal helpers (optional)
      _setStep: setStep,
      _setDraft: setDraft,
      _draft: draft,
      _step: step,
    }),
    [draft, step]
  );

  return <PrebookCtx.Provider value={api}>{children}</PrebookCtx.Provider>;
}

/**
 * Flow UI: place once in your layout (renders modals)
 */
export function PrebookFlow() {
  const navigate = useNavigate();
  const { close, _setStep, _setDraft, _draft, _step } = usePrebook();

  // ✅ UPDATED: accept the 3rd argument from PrebookDateTimeModal
  const onNextFromPicker = (date, startTime, startTimeUtcIso) => {
    _setDraft({ date, startTime, startTimeUtcIso });
    _setStep("PAYMENT");
  };

  const onSuccess = (result) => {
    close();
    navigate(`/booking/${result.bookingId}`, { state: result });
  };

  return (
    <>
      {_step === "INSTRUCTIONS" && (
        <PrebookInstructionsModal
          onClose={close}
          onContinue={() => _setStep("PICKER")}
        />
      )}

      {_step === "PICKER" && (
        <PrebookDateTimeModal onClose={close} onNext={onNextFromPicker} />
      )}

      {_step === "PAYMENT" && _draft && (
        <PaymentModal
          bookingDraft={_draft}
          onClose={close}
          onBack={() => _setStep("PICKER")}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}