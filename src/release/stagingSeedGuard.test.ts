import { describe, expect, it } from "vitest";
import { assertStagingSeedAllowed } from "./stagingSeedGuard";

const local = {
  DAN_SEED_TARGET: "staging",
  SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
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
    const remote = assertStagingSeedAllowed({
      DAN_SEED_TARGET: "staging",
      SUPABASE_DB_URL: "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres",
    });
    expect(remote.code).toBe(2);
    expect(
      assertStagingSeedAllowed({
        DAN_SEED_TARGET: "staging",
        DAN_STAGING_CONFIRM: "seed-staging-only",
        SUPABASE_DB_URL: "postgresql://postgres:postgres@db.example.supabase.co:5432/postgres",
      }).ok,
    ).toBe(true);
  });

  it("refuses the known production Supabase project ref", () => {
    expect(
      assertStagingSeedAllowed({
        DAN_SEED_TARGET: "staging",
        DAN_STAGING_CONFIRM: "seed-staging-only",
        SUPABASE_DB_URL:
          "postgresql://postgres:postgres@db.wmznpuhqmmqunwtewntt.supabase.co:5432/postgres",
      }).code,
    ).toBe(1);
  });
});
