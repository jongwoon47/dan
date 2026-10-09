import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  acceptCurrentConsents,
  fetchConsentRequirements,
  fetchMyConsent,
} from "./consentApi";
import {
  FALLBACK_PRIVACY_VERSION,
  FALLBACK_TERMS_VERSION,
  isConsentSatisfied,
  type ConsentRequirements,
  type UserConsentRecord,
} from "./consentVersions";
import { useAuth } from "./AuthProvider";

export type ConsentResolution =
  | "loading"
  | "required"
  | "satisfied"
  | "anonymous"
  | "error";

type ConsentContextValue = {
  resolution: ConsentResolution;
  record: UserConsentRecord | null;
  requirements: ConsentRequirements | null;
  error: string | null;
  accept: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

const DEMO_REQUIREMENTS: ConsentRequirements = {
  termsVersion: FALLBACK_TERMS_VERSION,
  privacyVersion: FALLBACK_PRIVACY_VERSION,
};

export function ConsentProvider({ children }: { children: ReactNode }) {
  const { mode, status, user } = useAuth();
  const [resolution, setResolution] = useState<ConsentResolution>(() =>
    mode === "demo" ? "satisfied" : status === "anonymous" ? "anonymous" : "loading",
  );
  const [record, setRecord] = useState<UserConsentRecord | null>(null);
  const [requirements, setRequirements] = useState<ConsentRequirements | null>(
    mode === "demo" ? DEMO_REQUIREMENTS : null,
  );
  const [error, setError] = useState<string | null>(null);
  const resolveRevision = useRef(0);

  const resolveForUser = useCallback(async (userId: string) => {
    const revision = ++resolveRevision.current;
    setResolution("loading");
    setError(null);
    try {
      const [nextRequirements, nextRecord] = await Promise.all([
        fetchConsentRequirements(),
        fetchMyConsent(),
      ]);
      if (revision !== resolveRevision.current) return;

      if (nextRecord && nextRecord.userId !== userId) {
        setRequirements(nextRequirements);
        setRecord(null);
        setResolution("required");
        return;
      }

      setRequirements(nextRequirements);
      setRecord(nextRecord);
      setResolution(
        isConsentSatisfied(nextRecord, nextRequirements) ? "satisfied" : "required",
      );
    } catch {
      if (revision !== resolveRevision.current) return;
      // Fail closed: never treat unknown consent as satisfied.
      setRecord(null);
      setRequirements(null);
      setError("load");
      setResolution("error");
    }
  }, []);

  useEffect(() => {
    if (mode === "demo") {
      resolveRevision.current += 1;
      setRecord(null);
      setRequirements(DEMO_REQUIREMENTS);
      setError(null);
      setResolution("satisfied");
      return;
    }
    if (status === "loading") {
      setResolution("loading");
      return;
    }
    if (status === "anonymous" || !user) {
      resolveRevision.current += 1;
      setRecord(null);
      setRequirements(null);
      setError(null);
      setResolution("anonymous");
      return;
    }
    void resolveForUser(user.id);
    return () => {
      resolveRevision.current += 1;
    };
  }, [mode, status, user?.id, resolveForUser]);

  const refresh = useCallback(async () => {
    if (mode === "demo" || !user) return;
    await resolveForUser(user.id);
  }, [mode, user, resolveForUser]);

  const accept = useCallback(async () => {
    if (mode === "demo") {
      setRequirements(DEMO_REQUIREMENTS);
      setResolution("satisfied");
      return;
    }
    const saved = await acceptCurrentConsents();
    const nextRequirements = await fetchConsentRequirements();
    setRequirements(nextRequirements);
    setRecord(saved);
    setError(null);
    setResolution(
      isConsentSatisfied(saved, nextRequirements) ? "satisfied" : "required",
    );
    if (!isConsentSatisfied(saved, nextRequirements)) {
      throw new Error("consent versions not current after save");
    }
  }, [mode]);

  const value = useMemo<ConsentContextValue>(
    () => ({ resolution, record, requirements, error, accept, refresh }),
    [resolution, record, requirements, error, accept, refresh],
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
