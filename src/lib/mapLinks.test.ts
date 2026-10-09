import { describe, expect, it } from "vitest";
import { externalRouteUrl } from "./mapLinks";

describe("explicit external route links", () => {
  it("creates valid public-place-only Google and Apple Maps directions", () => {
    const google = externalRouteUrl("google", "博多駅", "天神駅");
    expect(google).toContain("https://www.google.com/maps/dir/");
    expect(new URL(google!).searchParams.get("origin")).toBe("博多駅");
    expect(new URL(google!).searchParams.get("destination")).toBe("天神駅");
    const apple = externalRouteUrl("apple", "博多駅", "天神駅");
    expect(new URL(apple!).hostname).toBe("maps.apple.com");
    expect(new URL(apple!).searchParams.get("saddr")).toBe("博多駅");
  });
  it("does not construct links for missing or unreasonably long user input", () => {
    expect(externalRouteUrl("google", "", "天神駅")).toBeNull();
    expect(externalRouteUrl("apple", "博多駅", " ".repeat(10))).toBeNull();
    expect(externalRouteUrl("google", "x".repeat(121), "博多駅")).toBeNull();
  });
});
