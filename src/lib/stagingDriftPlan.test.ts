import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CONSENT_MIGRATION_FILES,
  FORWARD_MIGRATION_FILES,
  STAGING_LEDGER_TIP,
  migrationVersion,
  orderedForwardVersions,
} from "./stagingDriftPlan";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = path.join(root, "supabase/migrations");

describe("staging drift plan (filesystem)", () => {
  it("documents the confirmed staging ledger tip before forward versions", () => {
    expect(STAGING_LEDGER_TIP).toBe("20261006054157");
    const tipFile = readdirSync(migrationsDir).find((f) =>
      f.startsWith(STAGING_LEDGER_TIP),
    );
    expect(tipFile).toBeTruthy();
    const versions = orderedForwardVersions();
    expect(versions.every((v) => v > STAGING_LEDGER_TIP)).toBe(true);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]! > versions[i - 1]!).toBe(true);
    }
  });

  it("has every forward migration file in apply order", () => {
    for (const file of FORWARD_MIGRATION_FILES) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      expect(sql.length).toBeGreaterThan(0);
      expect(migrationVersion(file)).toMatch(/^2026100[789]/);
    }
    expect(FORWARD_MIGRATION_FILES.at(-1)).toBe(
      "20261009130000_jp_pilot_region_control.sql",
    );
  });

  it("consent migrations use IF NOT EXISTS for preexisting staging objects", () => {
    for (const file of CONSENT_MIGRATION_FILES) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      expect(sql).toMatch(/if not exists/i);
    }
    const userConsents = readFileSync(
      path.join(migrationsDir, "20261007000000_user_consents.sql"),
      "utf8",
    );
    expect(userConsents).toMatch(/create table if not exists public\.user_consents/i);
    const authority = readFileSync(
      path.join(migrationsDir, "20261008000000_consent_server_authority.sql"),
      "utf8",
    );
    expect(authority).toMatch(
      /create table if not exists public\.consent_requirements/i,
    );
  });

  it("simulate-staging-drift script embeds the same forward order", () => {
    const script = readFileSync(
      path.join(root, "scripts/simulate-staging-drift.mjs"),
      "utf8",
    );
    expect(script).toContain(STAGING_LEDGER_TIP);
    for (const file of FORWARD_MIGRATION_FILES) {
      expect(script).toContain(file);
    }
    const first = script.indexOf(FORWARD_MIGRATION_FILES[0]!);
    const last = script.indexOf(
      FORWARD_MIGRATION_FILES[FORWARD_MIGRATION_FILES.length - 1]!,
    );
    expect(first).toBeGreaterThan(-1);
    expect(last).toBeGreaterThan(first);
  });
});
