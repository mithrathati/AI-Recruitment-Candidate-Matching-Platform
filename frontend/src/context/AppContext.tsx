import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import type { ID, JobResponse } from "@/lib/api/types";

interface AppCtx {
  activeJob: JobResponse | null;
  activeJobId: ID | null;
  setActiveJob: (j: JobResponse | null) => void;
  setActiveJobId: (id: ID | null) => void;
}

const Ctx = createContext<AppCtx | null>(null);
const LS_KEY = "recruitment.activeJobId";

export function AppProvider({ children }: PropsWithChildren): JSX.Element {
  const [activeJobId, setActiveJobIdState] = useState<ID | null>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return Number(raw) || null;
    } catch {
      /* ignore */
    }
    return null;
  });
  const [activeJob, setActiveJob] = useState<JobResponse | null>(null);

  useEffect(() => {
    try {
      if (activeJobId) localStorage.setItem(LS_KEY, String(activeJobId));
      else localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }, [activeJobId]);

  const setActiveJobId = useCallback((id: ID | null) => {
    setActiveJobIdState(id);
    setActiveJob((prev) => (prev && id && prev.id === id ? prev : null));
  }, []);

  const value = useMemo<AppCtx>(
    () => ({ activeJob, activeJobId, setActiveJob, setActiveJobId }),
    [activeJob, activeJobId, setActiveJobId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveJob(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveJob must be used inside AppProvider");
  return ctx;
}
