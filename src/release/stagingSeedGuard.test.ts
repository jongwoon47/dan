import { describe, expect, it } from "vitest";
import { assertStagingSeedAllowed } from "./stagingSeedGuard";
import { STAGING_SUPABASE_PROJECT_REF } from "./environmentSeparation";

const local = {
  DAN_SEED_TARGET: "staging",
  SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
};

const stagingRef = STAGING_SUPABASE_PROJECT_REF;
const remote = {
  DAN_SEED_TARGET: "staging",
  DAN_STAGING_CONFIRM: "seed-staging-only",
  DAN_STAGING_SUPABASE_PROJECT_REF: stagingRef,
  SUPABASE_DB_URL: `postgresql://postgres:postgres@db.${stagingRef}.supabase.co:5432/postgres`,
};

describe("assertStagingSeedAllowed", () => {
  it("allows an explicit local staging seed", () => {
    expect(assertStagingSeedAllowed(local).ok).toBe(true);
  });

  it("refuses production even if someone also sets the staging flag", () => {
    expect(
      assertStagingSeedAllowed({ ...local, DAN_ENV: "production" }).code,
    ).toBe(1);
    expect(
      assertStagingSeedAllowed({ ...local, NODE_ENV: "production" }).message,
    ).toMatch(/production/);
  });

  it("refuses a missing target and demo mode", () => {
    expect(assertStagingSeedAllowed({}).code).toBe(1);
    expect(
      assertStagingSeedAllowed({ ...local, VITE_DATA_MODE: "demo" }).code,
    ).toBe(1);
  });

  it("asks for a database URL instead of inventing one", () => {
    expect(
      assertStagingSeedAllowed({ DAN_SEED_TARGET: "staging" }).code,
    ).toBe(2);
  });

  it("asks for confirmation before writing a remote database", () => {
    const unconfirmed = assertStagingSeedAllowed({
      DAN_SEED_TARGET: "staging",
      SUPABASE_DB_URL: remote.SUPABASE_DB_URL,
    });
    expect(unconfirmed.code).toBe(2);
  });

  it("asks for an expected staging project ref before remote seed", () => {
    expect(
      assertStagingSeedAllowed({
        DAN_SEED_TARGET: "staging",
        DAN_STAGING_CONFIRM: "seed-staging-only",
        SUPABASE_DB_URL: remote.SUPABASE_DB_URL,
      }).code,
    ).toBe(2);
  });

  it("refuses a remote seed whose project ref does not match", () => {
    expect(
      assertStagingSeedAllowed({
        ...remote,
        DAN_STAGING_SUPABASE_PROJECT_REF: "otherstagingref0001",
      }).code,
    ).toBe(1);
  });

  it("allows a matching remote staging ref without contacting the database", () => {
    expect(assertStagingSeedAllowed(remote).ok).toBe(true);
  });


});
