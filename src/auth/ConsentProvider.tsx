import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { acceptCurrentConsents, fetchMyConsent } from "./consentApi";
import { isConsentSatisfied, type UserConsentRecord } from "./consentVersions";
import { useAuth } from "./AuthProvider";

export type ConsentResolution = "loading" | "required" | "satisfied" | "anonymous";

type ConsentContextValue = {
  resolution: ConsentResolution;
  record: UserConsentRecord | null;
  error: string | null;
  accept: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const { mode, status, user } = useAuth();
  const [resolution, setResolution] = useState<ConsentResolution>(() =>
    mode === "demo" ? "satisfied" : status === "anonymous" ? "anonymous" : "loading",
  );
  const [record, setRecord] = useState<UserConsentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolveForUser = useCallback(async (userId: string) => {
    setResolution("loading");
    setError(null);
    try {
      const next = await fetchMyConsent();
      if (next && next.userId !== userId) {
        setRecord(null);
        setResolution("required");
        return;
      }
      setRecord(next);
      setResolution(isConsentSatisfied(next) ? "satisfied" : "required");
    } catch {
      // Fail closed: do not treat unknown consent as satisfied.
      setRecord(null);
      setError("consent");
      setResolution("required");
    }
  }, []);

  useEffect(() => {
    if (mode === "demo") {
      setRecord(null);
      setError(null);
      setResolution("satisfied");
      return;
    }
    if (status === "loading") {
      setResolution("loading");
      return;
    }
    if (status === "anonymous" || !user) {
      setRecord(null);
      setError(null);
      setResolution("anonymous");
      return;
    }
    void resolveForUser(user.id);
  }, [mode, status, user?.id, resolveForUser]);

  const refresh = useCallback(async () => {
    if (mode === "demo" || !user) return;
    await resolveForUser(user.id);
  }, [mode, user, resolveForUser]);

  const accept = useCallback(async () => {
    if (mode === "demo") {
      setResolution("satisfied");
      return;
    }
    const saved = await acceptCurrentConsents();
    setRecord(saved);
    setError(null);
    setResolution("satisfied");
  }, [mode]);

  const value = useMemo<ConsentContextValue>(
    () => ({ resolution, record, error, accept, refresh }),
    [resolution, record, error, accept, refresh],
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent() {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}

/** Post-login return path that never loops back into consent/login. */
export function consentReturnPath(raw: string | null | undefined): string {
  const fallback = "/";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  if (/^\/consent(\?|$)/.test(raw) || /^\/login(\?|$)/.test(raw)) return fallback;
  return raw;
}
