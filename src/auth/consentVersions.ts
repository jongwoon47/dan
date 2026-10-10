/**
 * Fallback document versions used only when the server requirements row is
 * unavailable in unit tests / demo. Runtime compares against
 * `get_consent_requirements()` so the database remains authoritative.
 */
export const FALLBACK_TERMS_VERSION = "2026-10-07";
export const FALLBACK_PRIVACY_VERSION = "2026-10-07";

/** @deprecated Prefer server requirements; kept as alias for existing imports/tests. */
export const CURRENT_TERMS_VERSION = FALLBACK_TERMS_VERSION;
/** @deprecated Prefer server requirements; kept as alias for existing imports/tests. */
export const CURRENT_PRIVACY_VERSION = FALLBACK_PRIVACY_VERSION;

export type ConsentRequirements = {
  termsVersion: string;
  privacyVersion: string;
};

export type UserConsentRecord = {
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
};

export function isConsentSatisfied(
  record: Pick<UserConsentRecord, "termsVersion" | "privacyVersion"> | null | undefined,
  requirements: ConsentRequirements,
): boolean {
  if (!record) return false;
  return (
    record.termsVersion === requirements.termsVersion &&
    record.privacyVersion === requirements.privacyVersion
  );
}

/** Same-origin static legal pages under /public. JA drafts live under /ja/. */
export function legalDocumentHref(
  doc: "terms" | "privacy",
  locale: "ko" | "ja" = "ko",
): string {
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return locale === "ja" ? `${root}ja/${doc}/` : `${root}${doc}/`;
}
