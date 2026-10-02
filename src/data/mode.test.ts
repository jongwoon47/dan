import { describe, expect, it } from "vitest";
import { PRODUCTION_SUPABASE_PROJECT_REFS } from "@/release/environmentSeparation";
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
        url: "https://stgstgprojectref001.supabase.co",
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

  it("refuses the known production Supabase project in staging", () => {
    const prodRef = PRODUCTION_SUPABASE_PROJECT_REFS[0];
    expect(() =>
      resolveDataMode({
        runtime: "staging",
        url: `https://${prodRef}.supabase.co`,
        anonKey: "sb_publishable_test",
      }),
    ).toThrow(/production Supabase/i);
  });

  it("requires the configured production Supabase project in production", () => {
    const prodRef = PRODUCTION_SUPABASE_PROJECT_REFS[0];
    expect(
      resolveDataMode({
        runtime: "production",
        url: `https://${prodRef}.supabase.co`,
        anonKey: "sb_publishable_test",
      }),
    ).toBe("supabase");
    expect(() =>
      resolveDataMode({
        runtime: "production",
        url: "https://stgstgprojectref001.supabase.co",
        anonKey: "sb_publishable_test",
      }),
    ).toThrow(/configured production Supabase/i);
  });

  it("refuses secret/service-role frontend keys", () => {
    expect(() =>
      resolveDataMode({
        runtime: "production",
        url: `https://${PRODUCTION_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
        anonKey: "sb_secret_never_ship_this",
      }),
    ).toThrow(/secret\/service-role/i);
  });
});
