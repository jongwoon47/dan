const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Prefer VITE_DATA_MODE; keep VITE_DAN_DATA_MODE as alias. */
const forced =
  (import.meta.env.VITE_DATA_MODE as string | undefined) ??
  (import.meta.env.VITE_DAN_DATA_MODE as string | undefined);

export function isSupabaseConfigured(): boolean {
  if (forced === "demo") return false;
  return Boolean(url?.trim() && anon?.trim());
}

export function getDataMode(): "supabase" | "demo" {
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export function getSupabaseEnv() {
  return {
    url: url?.trim() ?? "",
    anonKey: anon?.trim() ?? "",
  };
}
