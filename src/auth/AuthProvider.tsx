import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getDataMode, isSupabaseConfigured } from "@/data/mode";
import { getSupabase } from "@/data/supabase/client";
import * as api from "@/data/supabase/api";
import type { User } from "@/domain/types";
import { clearDeletedAccountStorage } from './accountDeletion';

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  mode: "supabase" | "demo";
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  error: string | null;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ confirmationRequired: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  finishAccountDeletion: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = getDataMode();
  const [status, setStatus] = useState<AuthStatus>(
    mode === "demo" ? "authenticated" : "loading",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "demo") {
      setStatus("authenticated");
      return;
    }

    let cancelled = false;
    let sessionRevision = 0;
    const sb = getSupabase();

    const fallbackUser = (next: Session): User => ({
      id: next.user.id,
      name: next.user.email ?? "DAN user",
      defaultArea: "",
    });

    const applySession = async (next: Session | null) => {
      const revision = ++sessionRevision;
      if (cancelled) return;
      setSession(next);

      if (!next) {
        setUser(null);
        setStatus("anonymous");
        return;
      }

      try {
        const { data: validated, error: validationError } = await sb.auth.getUser();
        if (cancelled || revision !== sessionRevision) return;
        if (validationError && [401, 403, 404].includes(validationError.status ?? 0)) {
          setSession(null); setUser(null); setStatus('anonymous');
          await sb.auth.signOut({ scope: 'local' });
          clearDeletedAccountStorage();
          return;
        }
        if (!validationError && !validated.user) {
          setSession(null); setUser(null); setStatus('anonymous'); return;
        }
        const profileUser = await api.fetchSessionUser();
        if (cancelled || revision !== sessionRevision) return;
        setUser(profileUser ?? fallbackUser(next));
        setError(null);
        setStatus("authenticated");
      } catch {
        if (cancelled || revision !== sessionRevision) return;
        // Preserve an otherwise valid auth session even when the profile
        // request is temporarily unavailable. The data provider owns retry UX.
        setUser(fallbackUser(next));
        setError("profile");
        setStatus("authenticated");
      }
    };

    void sb.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (sessionError) throw sessionError;
        return applySession(data.session);
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setUser(null);
        setError("auth");
        setStatus("anonymous");
      });

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      void applySession(next);
    });
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void sb.auth.getSession().then(({ data }) => applySession(data.session));
    };
    window.addEventListener('pageshow', onPageShow);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [mode]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    try {
      const data = await api.signUp(email, password, displayName);
      return { confirmationRequired: !data.session };
    } catch (e) {
      setError("auth");
      throw e;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await api.signIn(email, password);
    } catch (e) {
      setError("auth");
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    if (mode === "demo") return;
    try {
      await api.signOut();
    } catch (e) {
      setError("auth");
      throw e;
    }
  }, [mode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode,
      status,
      session,
      user,
      error,
      signUp,
      signIn,
      signOut,
      finishAccountDeletion: async () => {
        setSession(null); setUser(null); setStatus('anonymous'); setError(null);
        try { await getSupabase().auth.signOut({ scope: 'local' }); } catch { /* server already removed Auth */ }
        clearDeletedAccountStorage();
        // Full document replacement clears provider caches and history restoration.
        window.location.replace(`${import.meta.env.BASE_URL}login?account=deleted`);
      },
      clearError: () => setError(null),
    }),
    [mode, status, session, user, error, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireSupabaseAuth() {
  const auth = useAuth();
  return {
    ...auth,
    configured: isSupabaseConfigured(),
  };
}
