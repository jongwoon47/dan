import { STAGING_SUPABASE_PROJECT_REF } from "../src/release/environmentSeparation.ts";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;
const isolatedEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
};

function runApply(script: string, extraEnv: Record<string, string> = {}) {
  return spawnSync(
    node,
    ["--experimental-strip-types", path.join("scripts", script)],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...isolatedEnv, ...extraEnv },
    },
  );
}

describe("legacy remote apply scripts are default-deny", () => {
  it("refuses apply-migrations-remote.mjs with no env", () => {
    const result = runApply("apply-migrations-remote.mjs");
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toMatch(/default-deny|DAN_ENV/);
  });

  it("refuses apply-0016.mjs with no env", () => {
    const result = runApply("apply-0016.mjs");
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toMatch(/default-deny|DAN_ENV/);
  });

  it("refuses staging without confirm and production without confirm", () => {
    const staging = runApply("apply-migrations-remote.mjs", {
      DAN_ENV: "staging",
      DAN_STAGING_SUPABASE_PROJECT_REF: STAGING_SUPABASE_PROJECT_REF,
    });
    expect(staging.status).not.toBe(0);
    expect(`${staging.stderr}${staging.stdout}`).toMatch(/apply-staging-only/);

    const production = runApply("apply-0016.mjs", {
      DAN_ENV: "production",
      DAN_SUPABASE_PROJECT_REF: "wmznpuhqmmqunwtewntt",
    });
    expect(production.status).not.toBe(0);
    expect(`${production.stderr}${production.stdout}`).toMatch(
      /production Supabase project is not configured/i,
    );
  });

  it("refuses an unexpected staging ref before any remote token access", () => {
    const result = runApply("apply-migrations-remote.mjs", {
      DAN_ENV: "staging",
      DAN_REMOTE_CONFIRM: "apply-staging-only",
      DAN_STAGING_SUPABASE_PROJECT_REF: "otherstagingref001",
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toMatch(/unexpected staging/i);
  });

  it("refuses production applies before token access while production is unconfigured", () => {
    const result = runApply("apply-migrations-remote.mjs", {
      DAN_ENV: "production",
      DAN_REMOTE_CONFIRM: "apply-production-only",
      DAN_SUPABASE_PROJECT_REF: "futureprodref001",
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}${result.stdout}`).toMatch(/not configured/i);
  });
});
