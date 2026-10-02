import {
  PRODUCTION_REMOTE_CONFIRM,
  STAGING_PROJECT_REF_ENV,
  STAGING_REMOTE_CONFIRM,
  containsProductionSupabaseRef,
} from "./environmentSeparation.ts";

export type RemoteDbDecision = {
  ok: boolean;
  code: 0 | 1 | 2;
  message: string;
  projectRef?: string;
};

export function assertRemoteMigrationAllowed(
  env: Record<string, string | undefined>,
): RemoteDbDecision {
  const target = env.DAN_ENV?.trim() ?? "";
  if (!target) {
    return {
      ok: false,
      code: 2,
      message:
        "NEEDS USER: set DAN_ENV=staging or DAN_ENV=production. Remote DB work is default-deny.",
    };
  }

  if (target !== "staging" && target !== "production") {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: unknown DAN_ENV. Use staging or production.",
    };
  }

  const explicitRef = env.DAN_SUPABASE_PROJECT_REF?.trim() ?? "";
  const stagingRef = env.DAN_STAGING_SUPABASE_PROJECT_REF?.trim() ?? "";

  if (target === "staging") {
    if (env.DAN_REMOTE_CONFIRM !== STAGING_REMOTE_CONFIRM) {
      return {
        ok: false,
        code: 2,
        message: `NEEDS USER: staging remote apply requires DAN_REMOTE_CONFIRM=${STAGING_REMOTE_CONFIRM}.`,
      };
    }
    if (!stagingRef) {
      return {
        ok: false,
        code: 2,
        message: `NEEDS USER: ${STAGING_PROJECT_REF_ENV} for the staging project. Do not reuse production.`,
      };
    }
    if (
      containsProductionSupabaseRef(stagingRef) ||
      containsProductionSupabaseRef(explicitRef)
    ) {
      return {
        ok: false,
        code: 1,
        message: "REFUSED: staging cannot use a production Supabase project ref.",
      };
    }
    if (explicitRef && explicitRef !== stagingRef) {
      return {
        ok: false,
        code: 1,
        message:
          "REFUSED: DAN_SUPABASE_PROJECT_REF does not match DAN_STAGING_SUPABASE_PROJECT_REF.",
      };
    }
    return {
      ok: true,
      code: 0,
      message: "staging remote apply allowed",
      projectRef: stagingRef,
    };
  }

  if (env.DAN_REMOTE_CONFIRM !== PRODUCTION_REMOTE_CONFIRM) {
    return {
      ok: false,
      code: 2,
      message: `NEEDS USER: production remote apply requires DAN_REMOTE_CONFIRM=${PRODUCTION_REMOTE_CONFIRM}.`,
    };
  }
  if (!explicitRef) {
    return {
      ok: false,
      code: 2,
      message:
        "NEEDS USER: DAN_SUPABASE_PROJECT_REF must be set explicitly. Production ref is not a default.",
    };
  }

  return {
    ok: true,
    code: 0,
    message: "production remote apply allowed",
    projectRef: explicitRef,
  };
}
