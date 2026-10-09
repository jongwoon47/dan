import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { getSupabase } from "@/data/supabase/client";
import { safeReturnPath } from "@/lib/createDraft";
import { NATIVE_AUTH_FINISHED, NATIVE_RETURN_KEY, parseNativeAuthUrl } from "./nativeAuth";

export function NativeAuthBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const handled = new Set<string>();
    const finish = async (raw: string) => {
      const result = parseNativeAuthUrl(raw);
      if (!result || handled.has(raw)) return;
      handled.add(raw);
      let failed = result.failed || !result.code;
      if (!failed && result.code) {
        try {
          const { error } = await getSupabase().auth.exchangeCodeForSession(result.code);
          failed = Boolean(error);
        } catch { failed = true; }
      }
      try { await Browser.close(); } catch { /* Browser may already be closed. */ }
      if (disposed) return;
      const next = safeReturnPath(sessionStorage.getItem(NATIVE_RETURN_KEY));
      sessionStorage.removeItem(NATIVE_RETURN_KEY);
      const params = new URLSearchParams({ next });
      if (failed) params.set("error", "oauth_failed");
      navigate(`/login?${params}`, { replace: true });
      window.dispatchEvent(new Event(NATIVE_AUTH_FINISHED));
    };
    const opened = App.addListener("appUrlOpen", ({ url }) => { void finish(url); });
    const closed = Browser.addListener("browserFinished", () => {
      window.dispatchEvent(new Event(NATIVE_AUTH_FINISHED));
    });
    void opened.then(() => App.getLaunchUrl()).then((launch) => {
      if (launch?.url && !disposed) void finish(launch.url);
    });
    return () => {
      disposed = true;
      void opened.then((listener) => listener.remove());
      void closed.then((listener) => listener.remove());
    };
  }, [navigate]);
  return null;
}
