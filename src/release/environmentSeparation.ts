/**
 * Production vs staging identifiers. No secret values live here.
 *
 * Staging must never point at the public Cloudflare project `dan`,
 * `dan.pages.dev`, or the known production Supabase project ref.
 */

export const STAGING_CLOUDFLARE_PROJECT = "dan-staging";
export const STAGING_PAGES_URL = "https://dan-staging.pages.dev";
export const STAGING_DEPLOY_CONFIRM = "deploy-staging-only";
export const STAGING_SEED_CONFIRM = "seed-staging-only";
export const STAGING_GITHUB_ENVIRONMENT = "staging";

export const PRODUCTION_CLOUDFLARE_PROJECT = "dan";
export const PRODUCTION_PAGES_HOSTS = ["dan.pages.dev"] as const;

/**
 * Hardcoded in legacy production-only scripts (`scripts/apply-migrations-remote.mjs`,
 * `scripts/apply-0016.mjs`). Staging URL/DB values must not contain this ref.
 */
export const PRODUCTION_SUPABASE_PROJECT_REFS = [
  "wmznpuhqmmqunwtewntt",
] as const;

/** GitHub secret names for staging. Values are never committed. */
export const STAGING_GITHUB_SECRET_NAMES = [
  "STAGING_VITE_SUPABASE_URL",
  "STAGING_VITE_SUPABASE_ANON_KEY",
  "STAGING_CLOUDFLARE_API_TOKEN",
  "STAGING_CLOUDFLARE_ACCOUNT_ID",
  "STAGING_SUPABASE_DB_URL",
] as const;

/** Production GitHub secret names. Staging workflows must not read these. */
export const PRODUCTION_GITHUB_SECRET_NAMES = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
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
