/**
 * Staging drift reconciliation plan (docs/STAGING_DRIFT_RECONCILIATION_20261009.md).
 *
 * Confirmed staging assumptions:
 * - Ledger tip: 20261006054157 (account_deletion)
 * - Consent objects already present (out-of-band / alternate ledger names)
 * - Market columns, nearby RPCs, JP pilot control missing
 *
 * This module is filesystem/documentation only — it never opens a remote DB.
 */

export const STAGING_LEDGER_TIP = "20261006054157";

/** Forward-only versions to apply after tip, in ledger order. */
export const FORWARD_MIGRATION_FILES = [
  "20261007000000_user_consents.sql",
  "20261008000000_consent_server_authority.sql",
  "20261009000000_private_nearby_discovery.sql",
  "20261009010000_market_country_currency.sql",
  "20261009120000_market_partition_hardening.sql",
  "20261009130000_jp_pilot_region_control.sql",
] as const;

export const CONSENT_MIGRATION_FILES = [
  "20261007000000_user_consents.sql",
  "20261008000000_consent_server_authority.sql",
] as const;

export function migrationVersion(filename: string): string {
  return filename.replace(/_.*$/, "").replace(/\.sql$/, "");
}

export function orderedForwardVersions(): string[] {
  return FORWARD_MIGRATION_FILES.map(migrationVersion);
}
