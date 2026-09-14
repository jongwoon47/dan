import { describe, expect, it } from "vitest";
import { mergeBuyAggregate } from "@/domain/mergeAggregate";
import type { Demand, DemandAggregate } from "@/domain/types";

function buy(
  id: string,
  productId: string,
  maxPrice: number,
  userId = "u1",
): Demand {
  return {
    id,
    type: "BUY",
    userId,
    title: "t",
    description: "t",
    category: "electronics",
    budget: maxPrice,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    fulfillmentOptions: [{ mode: "SHIPPING" }],
    details: {
      productId,
      maxPrice,
      conditionPreference: "any",
      tradeMethod: "shipping",
    },
  };
}

describe("mergeBuyAggregate", () => {
  it("fills empty remote buckets from live demands", () => {
    const productId = "prod-1";
    const remote: DemandAggregate = {
      productId,
      seekerCount: 2,
      minPrice: 100000,
      maxPrice: 200000,
      avgPrice: 150000,
      recent7dDelta: 1,
      highestIntentPrice: 200000,
      priceBuckets: [],
    };
    const merged = mergeBuyAggregate(
      productId,
      [buy("d1", productId, 100_000), buy("d2", productId, 200_000, "u2")],
      remote,
    );
    expect(merged?.priceBuckets.length).toBeGreaterThan(0);
    expect(merged?.seekerCount).toBe(2);
    expect(merged?.fulfillmentSummary).toBeTruthy();
  });

  it("returns null when neither source has data", () => {
    expect(mergeBuyAggregate("x", [], null)).toBeNull();
  });
});
