import {
  STAGING_CLOUDFLARE_PROJECT,
  STAGING_DEPLOY_CONFIRM,
  STAGING_PROJECT_REF_ENV,
  STAGING_SUPABASE_PROJECT_REF,
  containsProductionSupabaseRef,
  extractSupabaseProjectRef,
  isForbiddenProductionTarget,
  isProductionCloudflareProject,
} from "./environmentSeparation.ts";

export type StagingDeployDecision = {
  ok: boolean;
  code: 0 | 1 | 2;
  message: string;
};

function looksLikeSecretKey(value: string): boolean {
  return /service_role|sb_secret/i.test(value);
}

export function assertStagingDeployAllowed(
  env: Record<string, string | undefined>,
): StagingDeployDecision {
  if (env.DAN_ENV === "production" || env.VITE_DAN_ENV === "production") {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: staging deploy cannot run with DAN_ENV=production.",
    };
  }

  if (env.GITHUB_REF_NAME === "main") {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: staging deploy cannot run from main.",
    };
  }

  if (env.STAGING_DEPLOY_CONFIRM !== STAGING_DEPLOY_CONFIRM) {
    return {
      ok: false,
      code: 2,
      message: `NEEDS USER: type ${STAGING_DEPLOY_CONFIRM} to confirm a staging-only deploy.`,
    };
  }

  const project =
    env.STAGING_CLOUDFLARE_PROJECT?.trim() ?? STAGING_CLOUDFLARE_PROJECT;
  if (
    isProductionCloudflareProject(project) ||
    project !== STAGING_CLOUDFLARE_PROJECT
  ) {
    return {
      ok: false,
      code: 1,
      message: `REFUSED: Cloudflare project must be ${STAGING_CLOUDFLARE_PROJECT}, never ${env.STAGING_CLOUDFLARE_PROJECT ?? ""}.`,
    };
  }

  const url = env.STAGING_VITE_SUPABASE_URL?.trim() ?? "";
  const anon = env.STAGING_VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !anon) {
    return {
      ok: false,
      code: 2,
      message:
        "NEEDS USER: STAGING_VITE_SUPABASE_URL and STAGING_VITE_SUPABASE_ANON_KEY for the staging project. Do not copy production secrets.",
    };
  }

  if (looksLikeSecretKey(anon) || looksLikeSecretKey(url)) {
    return {
      ok: false,
      code: 1,
      message:
        "REFUSED: staging frontend may only use the anon/publishable key. Never service_role.",
    };
  }

  const expectedRef =
    env.DAN_STAGING_SUPABASE_PROJECT_REF?.trim().toLowerCase() ?? "";
  if (!expectedRef) {
    return {
      ok: false,
      code: 2,
      message: `NEEDS USER: ${STAGING_PROJECT_REF_ENV} must identify the exact staging Supabase project.`,
    };
  }
  if (containsProductionSupabaseRef(expectedRef)) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: the expected staging Supabase ref is a production ref.",
    };
  }
  if (expectedRef !== STAGING_SUPABASE_PROJECT_REF) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: unexpected staging Supabase project ref.",
    };
  }

  const actualRef = extractSupabaseProjectRef(url);
  if (!actualRef) {
    return {
      ok: false,
      code: 1,
      message:
        "REFUSED: STAGING_VITE_SUPABASE_URL must expose a Supabase project ref.",
    };
  }
  if (actualRef !== expectedRef) {
    return {
      ok: false,
      code: 1,
      message:
        "REFUSED: STAGING_VITE_SUPABASE_URL does not match DAN_STAGING_SUPABASE_PROJECT_REF.",
    };
  }

  const inspected = [
    url,
    anon,
    expectedRef,
    env.STAGING_SUPABASE_DB_URL ?? "",
    env.STAGING_PAGES_URL ?? "",
  ];
  if (inspected.some((value) => isForbiddenProductionTarget(value))) {
    return {
      ok: false,
      code: 1,
      message:
        "REFUSED: staging values point at production Supabase or dan.pages.dev.",
    };
  }

  return { ok: true, code: 0, message: "staging deploy allowed" };
}
