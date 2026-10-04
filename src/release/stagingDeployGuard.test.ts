import { describe, expect, it } from "vitest";
import { assertStagingDeployAllowed } from "./stagingDeployGuard";
import {
  STAGING_CLOUDFLARE_PROJECT,
  STAGING_DEPLOY_CONFIRM,
  STAGING_SUPABASE_PROJECT_REF,
} from "./environmentSeparation";

const stagingRef = STAGING_SUPABASE_PROJECT_REF;
const staging = {
  DAN_ENV: "staging",
  STAGING_DEPLOY_CONFIRM,
  STAGING_CLOUDFLARE_PROJECT,
  DAN_STAGING_SUPABASE_PROJECT_REF: stagingRef,
  STAGING_VITE_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
  STAGING_VITE_SUPABASE_ANON_KEY: "sb_publishable_staging_placeholder",
};

describe("assertStagingDeployAllowed", () => {
  it("allows only the exact staging Cloudflare and Supabase projects", () => {
    expect(assertStagingDeployAllowed(staging).ok).toBe(true);
  });

  it("refuses production env, main, and non-staging Cloudflare projects", () => {
    expect(
      assertStagingDeployAllowed({ ...staging, DAN_ENV: "production" }).code,
    ).toBe(1);
    expect(
      assertStagingDeployAllowed({ ...staging, GITHUB_REF_NAME: "main" }).code,
    ).toBe(1);
    expect(
      assertStagingDeployAllowed({
        ...staging,
        STAGING_CLOUDFLARE_PROJECT: "dan",
      }).code,
    ).toBe(1);
    expect(
      assertStagingDeployAllowed({
        ...staging,
        STAGING_CLOUDFLARE_PROJECT: "dan-staging",
      }).code,
    ).toBe(1);
  });

  it("requires confirmation, public values, and an expected staging project ref", () => {
    expect(
      assertStagingDeployAllowed({
        ...staging,
        STAGING_DEPLOY_CONFIRM: undefined,
      }).code,
    ).toBe(2);
    expect(
      assertStagingDeployAllowed({
        ...staging,
        STAGING_VITE_SUPABASE_URL: undefined,
      }).code,
    ).toBe(2);
    expect(
      assertStagingDeployAllowed({
        ...staging,
        DAN_STAGING_SUPABASE_PROJECT_REF: undefined,
      }).code,
    ).toBe(2);
  });

  it("refuses a mismatched Supabase project ref", () => {
    expect(
      assertStagingDeployAllowed({
        ...staging,
        DAN_STAGING_SUPABASE_PROJECT_REF: "differentstagingref",
      }).code,
    ).toBe(1);

  });

  it("refuses production pages targets and service-role-like frontend values", () => {
    expect(
      assertStagingDeployAllowed({
        ...staging,
        STAGING_PAGES_URL: "https://dan.pages.dev",
      }).code,
    ).toBe(1);
    expect(
      assertStagingDeployAllowed({
        ...staging,
        STAGING_VITE_SUPABASE_ANON_KEY: "service_role-placeholder",
      }).code,
    ).toBe(1);
  });
});
