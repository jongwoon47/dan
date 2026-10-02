import { containsProductionSupabaseRef } from "@/release/environmentSeparation";

export type DataMode = "supabase" | "demo";

export type DataModeInput = {
  url?: string;
  anonKey?: string;
  forced?: string;
  runtime?: string;
};

const DEPLOYED_RUNTIMES = new Set(["staging", "production"]);
const KNOWN_RUNTIMES = new Set([
  "",
  "local",
  "development",
  "test",
  "staging",
  "production",
]);

export function resolveDataMode(input: DataModeInput): DataMode {
  const url = input.url?.trim() ?? "";
  const anonKey = input.anonKey?.trim() ?? "";
  const forced = input.forced?.trim().toLowerCase() ?? "";
  const runtime = input.runtime?.trim().toLowerCase() ?? "";
  const deployed = DEPLOYED_RUNTIMES.has(runtime);

  if (!KNOWN_RUNTIMES.has(runtime)) {
    throw new Error("Unknown VITE_DAN_ENV. Use local, staging, or production.");
  }
  if (forced && forced !== "demo" && forced !== "supabase") {
    throw new Error("Unknown data mode. Use demo or supabase.");
  }
  if (Boolean(url) !== Boolean(anonKey)) {
    throw new Error(
      "Supabase configuration is incomplete: URL and anon key must be set together.",
    );
  }

  if (forced === "demo") {
    if (deployed) {
      throw new Error("Deployed DAN environments cannot run in demo mode.");
    }
    return "demo";
  }

  if (url && anonKey) {
    if (runtime === "staging" && containsProductionSupabaseRef(url)) {
      throw new Error("Staging cannot use the production Supabase project.");
    }
    return "supabase";
  }

  if (forced === "supabase" || deployed) {
    throw new Error(
      `DAN ${runtime || "supabase"} requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`,
    );
  }

  return "demo";
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Prefer VITE_DATA_MODE; keep VITE_DAN_DATA_MODE as alias for local compatibility. */
const forced =
  (import.meta.env.VITE_DATA_MODE as string | undefined) ??
  (import.meta.env.VITE_DAN_DATA_MODE as string | undefined);
const runtime = import.meta.env.VITE_DAN_ENV as string | undefined;

export function getDataMode(): DataMode {
  return resolveDataMode({ url, anonKey: anon, forced, runtime });
}

export function isSupabaseConfigured(): boolean {
  return getDataMode() === "supabase";
}

export function getSupabaseEnv() {
  return {
    url: url?.trim() ?? "",
    anonKey: anon?.trim() ?? "",
  };
}
