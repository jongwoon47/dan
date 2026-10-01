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

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  mode: "supabase" | "demo";
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  error: string | null;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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
    const sb = getSupabase();

    const fallbackUser = (next: Session): User => ({
      id: next.user.id,
      name: next.user.email ?? "DAN user",
      defaultArea: "",
    });

    const applySession = async (next: Session | null) => {
      if (cancelled) return;
      setSession(next);

      if (!next) {
        setUser(null);
        setStatus("anonymous");
        return;
      }

      try {
        const profileUser = await api.fetchSessionUser();
        if (cancelled) return;
        setUser(profileUser ?? fallbackUser(next));
        setError(null);
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
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

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [mode]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    try {
      await api.signUp(email, password, displayName);
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
