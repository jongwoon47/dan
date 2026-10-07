/**
 * Production vs staging identifiers. No secret values live here.
 *
 * Staging must never point at the public Cloudflare project `dan`
 * or `dan.pages.dev`. Production and staging use separate Supabase refs;
 * both refs are public identifiers, never credentials.
 */

export const STAGING_CLOUDFLARE_PROJECT = "dan-v1-staging-jongwoon";
export const STAGING_PAGES_URL = "https://dan-v1-staging-jongwoon.pages.dev";
export const STAGING_DEPLOY_CONFIRM = "deploy-staging-only";
export const PRODUCTION_DEPLOY_CONFIRM = "deploy-production";
export const STAGING_SEED_CONFIRM = "seed-staging-only";
export const STAGING_REMOTE_CONFIRM = "apply-staging-only";
export const PRODUCTION_REMOTE_CONFIRM = "apply-production-only";
export const STAGING_GITHUB_ENVIRONMENT = "staging";
export const PRODUCTION_GITHUB_ENVIRONMENT = "production";
export const STAGING_PROJECT_REF_ENV = "DAN_STAGING_SUPABASE_PROJECT_REF";
export const PRODUCTION_PROJECT_REF_ENV = "DAN_PRODUCTION_SUPABASE_PROJECT_REF";
export const STAGING_SUPABASE_PROJECT_REF = "wmznpuhqmmqunwtewntt";

export const PRODUCTION_CLOUDFLARE_PROJECT = "dan";
export const PRODUCTION_PAGES_HOSTS = ["dan.pages.dev"] as const;

/** Approved production Supabase refs. Public identifiers only, never keys. */
export const PRODUCTION_SUPABASE_PROJECT_REFS = [
  "hcbooyexjgsjzjncpvtk",
] as const;

/** GitHub secret names for staging. Values are never committed. */
export const STAGING_GITHUB_SECRET_NAMES = [
  "STAGING_VITE_SUPABASE_URL",
  "STAGING_VITE_SUPABASE_ANON_KEY",
  "STAGING_CLOUDFLARE_API_TOKEN",
  "STAGING_CLOUDFLARE_ACCOUNT_ID",
  "STAGING_SUPABASE_DB_URL",
  "DAN_STAGING_SUPABASE_PROJECT_REF",
] as const;

/** Production GitHub secret names. Staging workflows must not read these. */
export const PRODUCTION_GITHUB_SECRET_NAMES = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "DAN_PRODUCTION_SUPABASE_PROJECT_REF",
] as const;

export function containsProductionSupabaseRef(value: string): boolean {
  const lower = value.toLowerCase();
  return PRODUCTION_SUPABASE_PROJECT_REFS.some((ref) =>
    lower.includes(ref.toLowerCase()),
  );
}

export function containsProductionPagesHost(value: string): boolean {
  const lower = value.toLowerCase();
  return PRODUCTION_PAGES_HOSTS.some((host) => lower.includes(host));
}

export function isForbiddenProductionTarget(value: string): boolean {
  return (
    containsProductionSupabaseRef(value) || containsProductionPagesHost(value)
  );
}

export function isProductionCloudflareProject(name: string): boolean {
  return name.trim() === PRODUCTION_CLOUDFLARE_PROJECT;
}

export function isLocalPostgresUrl(value: string): boolean {
  return /@(localhost|127\.0\.0\.1)(:|\/)/i.test(value);
}

/** Public project ref from a URL or host. Returns null when it cannot be determined. */
export function extractSupabaseProjectRef(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dbHost = trimmed.match(/@db\.([a-z0-9]+)\.supabase\.co(?:[:/?#]|$)/i);
  if (dbHost?.[1]) return dbHost[1].toLowerCase();

  const apiHost = trimmed.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co(?:[:/?#]|$)/i);
  if (apiHost?.[1]) return apiHost[1].toLowerCase();

  if (/pooler\.supabase\.com/i.test(trimmed)) {
    const poolerUser = trimmed.match(/:\/\/(?:postgres\.)([a-z0-9]+)[:@]/i);
    if (poolerUser?.[1]) return poolerUser[1].toLowerCase();
  }

  return null;
}
