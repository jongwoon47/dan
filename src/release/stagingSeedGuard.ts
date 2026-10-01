export type StagingSeedDecision = {
  ok: boolean;
  code: 0 | 1 | 2;
  message: string;
};

export function assertStagingSeedAllowed(
  env: Record<string, string | undefined>,
): StagingSeedDecision {
  if (
    env.DAN_ENV === "production" ||
    env.VITE_DAN_ENV === "production" ||
    env.NODE_ENV === "production"
  ) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: production seed is forbidden.",
    };
  }

  if (env.DAN_SEED_TARGET !== "staging") {
    return {
      ok: false,
      code: 1,
      message:
        "REFUSED: set DAN_SEED_TARGET=staging. Demo fixtures stay in the app, and production is never seeded.",
    };
  }

  if (env.VITE_DATA_MODE === "demo" || env.VITE_DAN_DATA_MODE === "demo") {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: demo mode must not write staging rows.",
    };
  }

  const dbUrl = env.SUPABASE_DB_URL?.trim() ?? "";
  if (!dbUrl) {
    return {
      ok: false,
      code: 2,
      message:
        "NEEDS USER: SUPABASE_DB_URL for the staging database. Do not put the anon key or service role in VITE_*.",
    };
  }

  if (/service_role|sb_secret|eyJ/i.test(dbUrl)) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: SUPABASE_DB_URL must be a Postgres URL, not an API key.",
    };
  }

  const local = /@(localhost|127\.0\.0\.1)(:|\/)/i.test(dbUrl);
  if (!local && env.DAN_STAGING_CONFIRM !== "seed-staging-only") {
    return {
      ok: false,
      code: 2,
      message:
        "NEEDS USER: remote staging seed requires DAN_STAGING_CONFIRM=seed-staging-only.",
    };
  }

  return { ok: true, code: 0, message: "staging seed allowed" };
}
