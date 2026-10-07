import { describe, expect, it } from "vitest";
import { assertProductionDeployAllowed } from "./productionDeployGuard";
import {
  PRODUCTION_CLOUDFLARE_PROJECT,
  PRODUCTION_DEPLOY_CONFIRM,
  PRODUCTION_SUPABASE_PROJECT_REFS,
  STAGING_SUPABASE_PROJECT_REF,
} from "./environmentSeparation";

const productionRef = PRODUCTION_SUPABASE_PROJECT_REFS[0]!;
const base = {
  DAN_ENV: "production",
  GITHUB_REF_NAME: "main",
  PRODUCTION_DEPLOY_CONFIRM,
  PRODUCTION_CLOUDFLARE_PROJECT,
  DAN_PRODUCTION_SUPABASE_PROJECT_REF: productionRef,
  PRODUCTION_VITE_SUPABASE_URL: `https://${productionRef}.supabase.co`,
  PRODUCTION_VITE_SUPABASE_ANON_KEY: "sb_publishable_production_placeholder",
};

describe("assertProductionDeployAllowed", () => {
  it("allows only the approved production project on main", () => {
    expect(assertProductionDeployAllowed(base).ok).toBe(true);
  });

  it("refuses staging, wrong refs, wrong branch, and missing confirmation", () => {
    expect(
      assertProductionDeployAllowed({
        ...base,
        PRODUCTION_VITE_SUPABASE_URL: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
        DAN_PRODUCTION_SUPABASE_PROJECT_REF: STAGING_SUPABASE_PROJECT_REF,
      }).code,
    ).toBe(1);
    expect(
      assertProductionDeployAllowed({
        ...base,
        DAN_PRODUCTION_SUPABASE_PROJECT_REF: "unknownprojectref",
      }).code,
    ).toBe(1);
    expect(assertProductionDeployAllowed({ ...base, GITHUB_REF_NAME: "feature/x" }).code).toBe(1);
    expect(assertProductionDeployAllowed({ ...base, PRODUCTION_DEPLOY_CONFIRM: undefined }).code).toBe(2);
  });

  it("refuses secret/service-role browser keys", () => {
    expect(
      assertProductionDeployAllowed({
        ...base,
        PRODUCTION_VITE_SUPABASE_ANON_KEY: "sb_secret_never_in_browser",
      }).code,
    ).toBe(1);
  });
});
