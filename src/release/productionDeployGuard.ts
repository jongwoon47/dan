import {
  PRODUCTION_CLOUDFLARE_PROJECT,
  PRODUCTION_DEPLOY_CONFIRM,
  PRODUCTION_SUPABASE_PROJECT_REFS,
  STAGING_SUPABASE_PROJECT_REF,
  containsProductionSupabaseRef,
  extractSupabaseProjectRef,
} from "./environmentSeparation.ts";

export type ProductionDeployDecision = {
  ok: boolean;
  code: 0 | 1 | 2;
  message: string;
};

function looksLikeSecretKey(value: string): boolean {
  return /service_role|sb_secret/i.test(value);
}

export function assertProductionDeployAllowed(
  env: Record<string, string | undefined>,
): ProductionDeployDecision {
  if (env.DAN_ENV !== "production" && env.VITE_DAN_ENV !== "production") {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: production deploy requires DAN_ENV=production.",
    };
  }

  if (env.GITHUB_REF_NAME && env.GITHUB_REF_NAME !== "main") {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: production deploy can run only from main.",
    };
  }

  if (env.PRODUCTION_DEPLOY_CONFIRM !== PRODUCTION_DEPLOY_CONFIRM) {
    return {
      ok: false,
      code: 2,
      message: `NEEDS USER: type ${PRODUCTION_DEPLOY_CONFIRM} to confirm production deploy.`,
    };
  }

  if (env.PRODUCTION_CLOUDFLARE_PROJECT?.trim() !== PRODUCTION_CLOUDFLARE_PROJECT) {
    return {
      ok: false,
      code: 1,
      message: `REFUSED: Cloudflare project must be ${PRODUCTION_CLOUDFLARE_PROJECT}.`,
    };
  }

  const url = env.PRODUCTION_VITE_SUPABASE_URL?.trim() ?? "";
  const key = env.PRODUCTION_VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  const expectedRef = env.DAN_PRODUCTION_SUPABASE_PROJECT_REF?.trim().toLowerCase() ?? "";

  if (!url || !key || !expectedRef) {
    return {
      ok: false,
      code: 2,
      message:
        "NEEDS USER: production Supabase URL, publishable key, and exact project ref are required.",
    };
  }
  if (looksLikeSecretKey(url) || looksLikeSecretKey(key)) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: browser production config may not contain service-role/secret keys.",
    };
  }

  const actualRef = extractSupabaseProjectRef(url);
  if (!actualRef || actualRef === STAGING_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: production URL points at staging or an invalid Supabase host.",
    };
  }
  if (
    !PRODUCTION_SUPABASE_PROJECT_REFS.includes(
      expectedRef as (typeof PRODUCTION_SUPABASE_PROJECT_REFS)[number],
    ) ||
    !containsProductionSupabaseRef(actualRef) ||
    actualRef !== expectedRef
  ) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: production Supabase URL/ref is not the approved production project.",
    };
  }

  return { ok: true, code: 0, message: "production deploy allowed" };
}
