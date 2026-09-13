import { describe, expect, it } from "vitest";

/**
 * Live Supabase integration gate.
 * Vitest forces demo mode; live E2E requires manual browser runs
 * (see docs/E2E_TEST_PLAN.md) after credentials + migrations.
 */
describe("supabase integration gate", () => {
  it("documents blocked live E2E without project credentials in CI", () => {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    const forcedDemo =
      import.meta.env.VITE_DATA_MODE === "demo" ||
      import.meta.env.VITE_DAN_DATA_MODE === "demo";
    const live = Boolean(url?.trim() && key?.trim()) && !forcedDemo;
    expect(live).toBe(false);
  });
});
