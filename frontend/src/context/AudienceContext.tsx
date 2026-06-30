import { createContext, useContext, useState, type ReactNode } from "react";

type Mode = "dealer" | "client";

interface AudienceContextValue {
  mode: Mode;
  isClientMode: boolean;
  clientPin: string | null;
  setClientPin: (pin: string) => void;
  enterClientMode: () => void;
  exitClientMode: (pin: string) => boolean;
  clearPin: () => void;
}

const AudienceContext = createContext<AudienceContextValue | null>(null);

const PIN_KEY = "audience_pin";

export function AudienceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("dealer");
  const [clientPin, setClientPinState] = useState<string | null>(
    () => sessionStorage.getItem(PIN_KEY)
  );

  function setClientPin(pin: string) {
    sessionStorage.setItem(PIN_KEY, pin);
    setClientPinState(pin);
  }

  function clearPin() {
    sessionStorage.removeItem(PIN_KEY);
    setClientPinState(null);
  }

  function enterClientMode() {
    setMode("client");
  }

  function exitClientMode(pin: string): boolean {
    if (!clientPin || pin === clientPin) {
      setMode("dealer");
      return true;
    }
    return false;
  }

  return (
    <AudienceContext.Provider
      value={{
        mode,
        isClientMode: mode === "client",
        clientPin,
        setClientPin,
        enterClientMode,
        exitClientMode,
        clearPin,
      }}
    >
      {children}
    </AudienceContext.Provider>
  );
}

export function useAudience(): AudienceContextValue {
  const ctx = useContext(AudienceContext);
  if (!ctx) throw new Error("useAudience must be used within AudienceProvider");
  return ctx;
}
