import { describe, expect, it } from "vitest";
import { assertRemoteMigrationAllowed } from "./remoteDbTargetGuard";
import {
  PRODUCTION_REMOTE_CONFIRM,
  PRODUCTION_SUPABASE_PROJECT_REFS,
  STAGING_REMOTE_CONFIRM,
  STAGING_SUPABASE_PROJECT_REF,
  extractSupabaseProjectRef,
} from "./environmentSeparation";

const stagingRef = STAGING_SUPABASE_PROJECT_REF;

describe("extractSupabaseProjectRef", () => {
  it("reads db host and API host refs", () => {
    expect(
      extractSupabaseProjectRef(
        `postgresql://postgres:postgres@db.${stagingRef}.supabase.co:5432/postgres`,
      ),
    ).toBe(stagingRef);
    expect(extractSupabaseProjectRef(`https://${stagingRef}.supabase.co`)).toBe(
      stagingRef,
    );
  });

  it("returns null when the ref is not in the URL", () => {
    expect(
      extractSupabaseProjectRef(
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      ),
    ).toBeNull();
  });
});

describe("assertRemoteMigrationAllowed", () => {
  it("refuses missing target, unknown target, and missing confirms", () => {
    expect(assertRemoteMigrationAllowed({}).code).toBe(2);
    expect(assertRemoteMigrationAllowed({ DAN_ENV: "other" }).code).toBe(1);
    expect(
      assertRemoteMigrationAllowed({
        DAN_ENV: "staging",
        DAN_STAGING_SUPABASE_PROJECT_REF: stagingRef,
      }).code,
    ).toBe(2);
    expect(
      assertRemoteMigrationAllowed({
        DAN_ENV: "production",
        DAN_SUPABASE_PROJECT_REF: "futureprodref001",
      }).code,
    ).toBe(1);
  });

  it("refuses any staging ref other than the designated project", () => {
    expect(
      assertRemoteMigrationAllowed({
        DAN_ENV: "staging",
        DAN_REMOTE_CONFIRM: STAGING_REMOTE_CONFIRM,
        DAN_STAGING_SUPABASE_PROJECT_REF: "otherstagingref001",
      }).code,
    ).toBe(1);
  });

  it("allows an explicit staging ref without contacting a database", () => {
    const allowed = assertRemoteMigrationAllowed({
      DAN_ENV: "staging",
      DAN_REMOTE_CONFIRM: STAGING_REMOTE_CONFIRM,
      DAN_STAGING_SUPABASE_PROJECT_REF: stagingRef,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.projectRef).toBe(stagingRef);
  });

  it("allows only the explicit approved production project", () => {
    const productionRef = PRODUCTION_SUPABASE_PROJECT_REFS[0]!;
    const allowed = assertRemoteMigrationAllowed({
      DAN_ENV: "production",
      DAN_REMOTE_CONFIRM: PRODUCTION_REMOTE_CONFIRM,
      DAN_SUPABASE_PROJECT_REF: productionRef,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.projectRef).toBe(productionRef);

    expect(
      assertRemoteMigrationAllowed({
        DAN_ENV: "production",
        DAN_REMOTE_CONFIRM: PRODUCTION_REMOTE_CONFIRM,
        DAN_SUPABASE_PROJECT_REF: "futureprodref001",
      }).code,
    ).toBe(1);
  });
});
