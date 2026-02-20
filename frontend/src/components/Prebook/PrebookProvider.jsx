import { createContext, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import PrebookInstructionsModal from "./PrebookInstructionsModal";
import PrebookDateTimeModal from "./PrebookDateTimeModal";
import PaymentModal from "./PaymentModal";

const PrebookCtx = createContext(null);

export const usePrebook = () => {
  const ctx = useContext(PrebookCtx);
  if (!ctx) throw new Error("usePrebook must be used inside <PrebookProvider>");
  return ctx;
};

export default function PrebookProvider({ children }) {
  const navigate = useNavigate();

  const [step, setStep] = useState("CLOSED"); // CLOSED | INSTRUCTIONS | PICKER | PAYMENT
  const [draft, setDraft] = useState(null); // { date, startTime }

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
    }),
    []
  );

  const onNextFromPicker = (date, startTime) => {
    setDraft({ date, startTime });
    setStep("PAYMENT");
  };

  const onSuccess = (result) => {
    api.close();
    navigate(`/booking/${result.bookingId}`, { state: result });
  };

  return (
    <PrebookCtx.Provider value={api}>
      {children}

      {step === "INSTRUCTIONS" && (
        <PrebookInstructionsModal
          onClose={api.close}
          onContinue={() => setStep("PICKER")}
        />
      )}

      {step === "PICKER" && (
        <PrebookDateTimeModal onClose={api.close} onNext={onNextFromPicker} />
      )}

      {step === "PAYMENT" && draft && (
        <PaymentModal
          bookingDraft={draft}
          onClose={api.close}
          onBack={() => setStep("PICKER")}
          onSuccess={onSuccess}
        />
      )}
    </PrebookCtx.Provider>
  );
}