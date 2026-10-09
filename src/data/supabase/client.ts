import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { getSupabaseEnv, isSupabaseConfigured } from "../mode";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
  }
  if (!client) {
    const { url, anonKey } = getSupabaseEnv();
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !Capacitor.isNativePlatform(),
        flowType: Capacitor.isNativePlatform() ? "pkce" : "implicit",
      },
    });
  }
  return client;
}

export type { SupabaseClient };
