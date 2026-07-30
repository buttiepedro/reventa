import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/services/api";

type Mode = "dealer" | "client";

interface AudienceContextValue {
  mode: Mode;
  isClientMode: boolean;
  enterClientMode: (pin: string) => Promise<boolean>;
  exitClientMode: () => void;
  setPin: (pin: string) => Promise<void>;
  deletePin: () => Promise<void>;
}

const AudienceContext = createContext<AudienceContextValue | null>(null);

export function AudienceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("dealer");
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Auto-lock on visibility change: if user hides the app while in client mode,
  // require PIN again when they return
  useEffect(() => {
    let hiddenAt: number | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (modeRef.current === "client") hiddenAt = Date.now();
      } else {
        if (hiddenAt !== null) {
          hiddenAt = null;
          setMode("dealer");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  async function enterClientMode(pin: string): Promise<boolean> {
    try {
      const { valid } = await api.post<{ valid: boolean }>("/users/me/audience-pin/verify", { pin });
      if (valid) setMode("client");
      return valid;
    } catch {
      return false;
    }
  }

  function exitClientMode() {
    setMode("dealer");
  }

  async function setPin(pin: string): Promise<void> {
    await api.put("/users/me/audience-pin", { pin });
  }

  async function deletePin(): Promise<void> {
    await api.delete("/users/me/audience-pin");
  }

  return (
    <AudienceContext.Provider value={{ mode, isClientMode: mode === "client", enterClientMode, exitClientMode, setPin, deletePin }}>
      {children}
    </AudienceContext.Provider>
  );
}

export function useAudience(): AudienceContextValue {
  const ctx = useContext(AudienceContext);
  if (!ctx) throw new Error("useAudience must be used within AudienceProvider");
  return ctx;
}
