import { describe, expect, it } from "vitest";
import {
  NullRouteMetricsProvider,
  labelSpecificityScore,
  rankRouteCandidates,
  rankRouteCandidatesSync,
  routeMatchSpecificity,
  searchRouteCandidates,
  type RouteCandidateDemand,
  type RouteMetricsProvider,
} from "./routeCandidates";

function routeDemand(
  id: string,
  from: { publicLabel: string; region2?: string },
  to: { publicLabel: string; region2?: string },
  createdAt = "2026-10-01T00:00:00.000Z",
): RouteCandidateDemand {
  return {
    id,
    createdAt,
    status: "ACTIVE",
    fulfillmentOptions: [{ mode: "ROUTE", from, to }],
  };
}

describe("searchRouteCandidates / rankRouteCandidates", () => {
  const hakataTenjin = routeDemand(
    "exact",
    { publicLabel: "福岡県 · 博多駅", region2: "博多駅" },
    { publicLabel: "福岡県 · 天神駅", region2: "天神駅" },
    "2026-10-02T00:00:00.000Z",
  );
  const loose = routeDemand(
    "loose",
    { publicLabel: "福岡市 博多区", region2: "博多区" },
    { publicLabel: "福岡市 中央区", region2: "中央区" },
    "2026-10-03T00:00:00.000Z",
  );
  const reverse = routeDemand(
    "reverse",
    { publicLabel: "福岡県 · 天神駅", region2: "天神駅" },
    { publicLabel: "福岡県 · 博多駅", region2: "博多駅" },
  );
  const onsite: RouteCandidateDemand = {
    id: "onsite",
    createdAt: "2026-10-01T00:00:00.000Z",
    status: "ACTIVE",
    fulfillmentOptions: [{ mode: "ONSITE", place: { publicLabel: "博多駅" } }],
  };

  it("matches FROM→TO directionally and ignores reverse / non-ROUTE", () => {
    const found = searchRouteCandidates(
      [hakataTenjin, reverse, onsite],
      "博多駅",
      "天神駅",
    );
    expect(found.map((d) => d.id)).toEqual(["exact"]);
  });

  it("scores exact station labels higher than broader containing labels", () => {
    expect(labelSpecificityScore("博多駅", "博多駅")).toBe(100);
    expect(labelSpecificityScore("福岡市 博多駅", "博多駅")).toBeGreaterThan(0);
    expect(labelSpecificityScore("福岡市 博多駅", "博多駅")).toBeLessThan(100);
    // Distinct ward vs station glyphs are not substring matches (same as locationDiscovery).
    expect(labelSpecificityScore("博多区", "博多駅")).toBe(0);

    const exactScore = routeMatchSpecificity(hakataTenjin, "博多駅", "天神駅");
    const looseScore = routeMatchSpecificity(loose, "博多駅", "天神駅");
    expect(exactScore).toBeGreaterThan(0);
    expect(exactScore).toBeGreaterThan(looseScore);
  });

  it("ranks by specificity and never invents ETA/detour with null provider", () => {
    const adminRoute = routeDemand(
      "admin",
      { publicLabel: "福岡市 博多駅", region2: "博多区" },
      { publicLabel: "福岡市 天神駅", region2: "中央区" },
      "2026-10-04T00:00:00.000Z",
    );
    const ranked = rankRouteCandidatesSync([adminRoute, hakataTenjin, reverse], {
      routeFrom: "博多駅",
      routeTo: "天神駅",
    });
    expect(ranked.map((c) => c.demand.id)).toEqual(["exact", "admin"]);
    for (const candidate of ranked) {
      expect(candidate.metricsAvailable).toBe(false);
      expect(candidate.etaMinutes).toBeNull();
      expect(candidate.detourMinutes).toBeNull();
    }
  });

  it("NullRouteMetricsProvider reports unavailable metrics", () => {
    const provider = new NullRouteMetricsProvider();
    const metrics = provider.getMetrics({
      routeFrom: "A",
      routeTo: "B",
      demandFrom: { publicLabel: "A" },
      demandTo: { publicLabel: "B" },
    });
    expect(metrics.available).toBe(false);
    expect(metrics.etaMinutes).toBeNull();
    expect(metrics.detourMinutes).toBeNull();
  });

  it("uses real provider metrics when available without fabricating for others", async () => {
    const realProvider: RouteMetricsProvider = {
      getMetrics() {
        return { available: true, etaMinutes: 18, detourMinutes: 4 };
      },
    };
    const ranked = await rankRouteCandidates([hakataTenjin], {
      routeFrom: "博多駅",
      routeTo: "天神駅",
      metricsProvider: realProvider,
    });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].metricsAvailable).toBe(true);
    expect(ranked[0].etaMinutes).toBe(18);
    expect(ranked[0].detourMinutes).toBe(4);
  });

  it("requires both endpoints", () => {
    expect(searchRouteCandidates([hakataTenjin], "博多駅", "")).toEqual([]);
    expect(routeMatchSpecificity(hakataTenjin, "", "天神駅")).toBe(0);
  });
});
