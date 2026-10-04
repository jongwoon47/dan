import { describe, expect, it } from "vitest";
import { STAGING_SUPABASE_PROJECT_REF } from "@/release/environmentSeparation";
import { resolveDataMode } from "./mode";

describe("resolveDataMode", () => {
  it("keeps no-secret local development in demo mode", () => {
    expect(resolveDataMode({ runtime: "local" })).toBe("demo");
    expect(resolveDataMode({})).toBe("demo");
  });

  it("uses Supabase when both public values are configured", () => {
    expect(
      resolveDataMode({
        runtime: "staging",
        url: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
        anonKey: "sb_publishable_test",
      }),
    ).toBe("supabase");
  });

  it("refuses partial Supabase configuration everywhere", () => {
    expect(() =>
      resolveDataMode({ url: "https://example.supabase.co" }),
    ).toThrow(/incomplete/i);
  });

  it("refuses silent demo fallback in staging and production", () => {
    expect(() => resolveDataMode({ runtime: "staging" })).toThrow(
      /requires VITE_SUPABASE_URL/i,
    );
    expect(() => resolveDataMode({ runtime: "production" })).toThrow(
      /requires VITE_SUPABASE_URL/i,
    );
    expect(() =>
      resolveDataMode({ runtime: "production", forced: "demo" }),
    ).toThrow(/cannot run in demo mode/i);
  });

  it("refuses any non-designated Supabase project in staging", () => {
    expect(() =>
      resolveDataMode({
        runtime: "staging",
        url: "https://otherstagingref001.supabase.co",
        anonKey: "sb_publishable_test",
      }),
    ).toThrow(/designated staging/i);
  });

  it("keeps production disabled until a separate production DB is configured", () => {
    expect(() =>
      resolveDataMode({
        runtime: "production",
        url: "https://futureprodref001.supabase.co",
        anonKey: "sb_publishable_test",
      }),
    ).toThrow(/not configured/i);
  });

  it("refuses secret/service-role frontend keys", () => {
    expect(() =>
      resolveDataMode({
        runtime: "staging",
        url: `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`,
        anonKey: "sb_secret_never_ship_this",
      }),
    ).toThrow(/secret\/service-role/i);
  });
});
