import { getSupabase } from "@/data/supabase/client";
import type { ConsentRequirements, UserConsentRecord } from "./consentVersions";

type DbConsent = {
  user_id: string;
  terms_version: string;
  privacy_version: string;
  terms_accepted_at: string;
  privacy_accepted_at: string;
};

function mapConsent(row: DbConsent): UserConsentRecord {
  return {
    userId: row.user_id,
    termsVersion: row.terms_version,
    privacyVersion: row.privacy_version,
    termsAcceptedAt: row.terms_accepted_at,
    privacyAcceptedAt: row.privacy_accepted_at,
  };
}

export async function fetchConsentRequirements(): Promise<ConsentRequirements> {
  const { data, error } = await getSupabase().rpc("get_consent_requirements");
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  const termsVersion =
    typeof row.termsVersion === "string" ? row.termsVersion.trim() : "";
  const privacyVersion =
    typeof row.privacyVersion === "string" ? row.privacyVersion.trim() : "";
  if (!termsVersion || !privacyVersion) {
    throw new Error("consent requirements missing");
  }
  return { termsVersion, privacyVersion };
}

export async function fetchMyConsent(): Promise<UserConsentRecord | null> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb
    .from("user_consents")
    .select(
      "user_id, terms_version, privacy_version, terms_accepted_at, privacy_accepted_at",
    )
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapConsent(data as DbConsent) : null;
}

/** Server assigns versions + timestamps; clients cannot forge either. */
export async function acceptCurrentConsents(): Promise<UserConsentRecord> {
  const { data, error } = await getSupabase().rpc("accept_my_consents");
  if (error || !data) {
    throw error ?? new Error("consent save failed");
  }
  return mapConsent(data as DbConsent);
}
