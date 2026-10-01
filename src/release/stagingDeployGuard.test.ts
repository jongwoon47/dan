import { describe, expect, it } from "vitest";
import { assertStagingDeployAllowed } from "./stagingDeployGuard";
import {
  STAGING_CLOUDFLARE_PROJECT,
  STAGING_DEPLOY_CONFIRM,
} from "./environmentSeparation";

const staging = {
  DAN_ENV: "staging",
  STAGING_DEPLOY_CONFIRM,
  STAGING_CLOUDFLARE_PROJECT,
  STAGING_VITE_SUPABASE_URL: "https://example-staging.supabase.co",
  STAGING_VITE_SUPABASE_ANON_KEY: "sb_publishable_staging_placeholder",
};

describe("assertStagingDeployAllowed", () => {
  it("allows a staging-only Cloudflare project with staging secrets", () => {
    expect(assertStagingDeployAllowed(staging).ok).toBe(true);
  });

  it("refuses production env, main, and the public dan project", () => {
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
  });

  it("asks for confirmation and staging public values instead of inventing them", () => {
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
  });

  it("refuses production Supabase ref, pages host, and service_role", () => {
    expect(
      assertStagingDeployAllowed({
        ...staging,
        STAGING_VITE_SUPABASE_URL:
          "https://wmznpuhqmmqunwtewntt.supabase.co",
      }).code,
    ).toBe(1);
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
