import { describe, expect, it } from "vitest";

import {
  canCreateMatch,
  isConditionCompatible,
  isPriceCompatible,
} from "@/domain/matching";
import type { Demand, SellIntent } from "@/domain/types";

const demand = (overrides: Partial<Demand> = {}): Demand => ({
  id: "d1",
  userId: "buyer",
  productId: "p1",
  maxPrice: 1_800_000,
  conditionPreference: "any",
  location: "Seoul",
  tradeMethod: "any",
  status: "ACTIVE",
  createdAt: new Date().toISOString(),
  expiresAt: new Date().toISOString(),
  ...overrides,
});

const sell = (overrides: Partial<SellIntent> = {}): SellIntent => ({
  id: "s1",
  ownershipId: "o1",
  userId: "seller",
  productId: "p1",
  minimumPrice: 1_700_000,
  status: "OPEN",
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("matching", () => {
  it("matches when buyer max covers seller minimum", () => {
    expect(isPriceCompatible(1_800_000, 1_700_000)).toBe(true);
    expect(isPriceCompatible(1_600_000, 1_700_000)).toBe(false);
  });

  it("requires ownership condition to meet preference", () => {
    expect(isConditionCompatible("like_new", "sealed")).toBe(true);
    expect(isConditionCompatible("sealed", "lightly_used")).toBe(false);
    expect(isConditionCompatible("any", "lightly_used")).toBe(true);
  });

  it("creates match only for same product and compatible terms", () => {
    expect(
      canCreateMatch({
        demand: demand(),
        sellIntent: sell(),
        ownershipCondition: "lightly_used",
      }),
    ).toBe(true);

    expect(
      canCreateMatch({
        demand: demand({ maxPrice: 1_500_000 }),
        sellIntent: sell({ minimumPrice: 1_900_000 }),
        ownershipCondition: "lightly_used",
      }),
    ).toBe(false);

    expect(
      canCreateMatch({
        demand: demand({ productId: "other" }),
        sellIntent: sell(),
        ownershipCondition: "lightly_used",
      }),
    ).toBe(false);
  });
});
