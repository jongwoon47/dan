import { getSupabase } from "@/data/supabase/client";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  type UserConsentRecord,
} from "./consentVersions";

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

export async function acceptCurrentConsents(): Promise<UserConsentRecord> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("not authenticated");

  const now = new Date().toISOString();
  const payload = {
    user_id: auth.user.id,
    terms_version: CURRENT_TERMS_VERSION,
    privacy_version: CURRENT_PRIVACY_VERSION,
    terms_accepted_at: now,
    privacy_accepted_at: now,
  };

  const { data, error } = await sb
    .from("user_consents")
    .upsert(payload, { onConflict: "user_id" })
    .select(
      "user_id, terms_version, privacy_version, terms_accepted_at, privacy_accepted_at",
    )
    .single();

  if (error || !data) {
    throw error ?? new Error("consent save failed");
  }
  return mapConsent(data as DbConsent);
}
