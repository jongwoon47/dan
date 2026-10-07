/** Required consent document versions. Bump when terms/privacy materially change. */
export const CURRENT_TERMS_VERSION = "2026-10-07";
export const CURRENT_PRIVACY_VERSION = "2026-10-07";

export type UserConsentRecord = {
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
};

export function isConsentSatisfied(
  record: Pick<UserConsentRecord, "termsVersion" | "privacyVersion"> | null | undefined,
  termsVersion = CURRENT_TERMS_VERSION,
  privacyVersion = CURRENT_PRIVACY_VERSION,
): boolean {
  if (!record) return false;
  return (
    record.termsVersion === termsVersion &&
    record.privacyVersion === privacyVersion
  );
}

/** Same-origin static legal pages under /public. */
export function legalDocumentHref(doc: "terms" | "privacy"): string {
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}${doc}/`;
}
