// src/hooks/useAuth.js
import { useEffect, useState } from "react";
import { APP_EVENTS } from "../lib/appEvents";
import { STORAGE_KEYS } from "../lib/storageKeys";

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN))
  );

  useEffect(() => {
    const sync = () => {
      setIsLoggedIn(Boolean(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)));
    };

    window.addEventListener("storage", sync);
    window.addEventListener(APP_EVENTS.AUTH_CHANGED, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(APP_EVENTS.AUTH_CHANGED, sync);
    };
  }, []);

  return { isLoggedIn };
}