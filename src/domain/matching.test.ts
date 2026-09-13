import { describe, expect, it } from "vitest";

import { aggregateDemands } from "@/domain/aggregation";
import { upsertActiveDemand } from "@/domain/demands";
import { buildFeedItems, classifyFeedItem } from "@/domain/feed";
import {
  canExpressBuyerInterest,
  canSellerConnect,
  listMatchCandidates,
  mergeVisibleMatches,
  transitionBuyerInterest,
  transitionSellerConnect,
} from "@/domain/matchLifecycle";
import {
  canCreateMatch,
  isConditionCompatible,
  isPriceCompatible,
} from "@/domain/matching";
import { canRespondToDemand } from "@/domain/responses";
import { upsertOpenSellIntent } from "@/domain/sellIntents";
import type { BuyDemand, Match, Ownership, Product, SellIntent } from "@/domain/types";

const NOW = Date.parse("2026-09-13T12:00:00.000Z");

const demand = (overrides: Partial<BuyDemand> & { details?: Partial<BuyDemand["details"]> } = {}): BuyDemand => {
  const { details: detailOverrides, ...rest } = overrides;
  return {
    id: "d1",
    userId: "buyer",
    type: "BUY",
    title: "Item",
    description: "Item",
    category: "electronics",
    budget: detailOverrides?.maxPrice ?? 1_800_000,
    fulfillmentOptions: [{ mode: "SHIPPING" }],
    status: "ACTIVE",
    createdAt: "2026-09-01T00:00:00.000Z",
    expiresAt: "2026-10-13T00:00:00.000Z",
    ...rest,
    details: {
      productId: "p1",
      maxPrice: 1_800_000,
      conditionPreference: "any",
      tradeMethod: "any",
      ...detailOverrides,
    },
  };
};

const sell = (overrides: Partial<SellIntent> = {}): SellIntent => ({
  id: "s1",
  ownershipId: "o1",
  userId: "seller",
  productId: "p1",
  minimumPrice: 1_700_000,
  status: "OPEN",
  createdAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

const ownership = (overrides: Partial<Ownership> = {}): Ownership => ({
  id: "o1",
  userId: "seller",
  productId: "p1",
  condition: "lightly_used",
  status: "OWNED",
  createdAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

describe("matching compatibility", () => {
  it("matches when buyer max covers seller minimum", () => {
    expect(isPriceCompatible(1_800_000, 1_700_000)).toBe(true);
    expect(isPriceCompatible(1_600_000, 1_700_000)).toBe(false);
  });

  it("requires ownership condition to meet preference", () => {
    expect(isConditionCompatible("like_new", "sealed")).toBe(true);
    expect(isConditionCompatible("sealed", "lightly_used")).toBe(false);
    expect(isConditionCompatible("any", "lightly_used")).toBe(true);
  });

  it("rejects buyer max < seller min", () => {
    expect(
      canCreateMatch({
        demand: demand({ details: { productId: "p1", maxPrice: 1_500_000, conditionPreference: "any", tradeMethod: "any" } }),
        sellIntent: sell({ minimumPrice: 1_900_000 }),
        ownershipCondition: "lightly_used",
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("rejects same-user self match", () => {
    expect(
      canCreateMatch({
        demand: demand({ userId: "same" }),
        sellIntent: sell({ userId: "same" }),
        ownershipCondition: "lightly_used",
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("rejects expired demand even when ACTIVE", () => {
    expect(
      canCreateMatch({
        demand: demand({ expiresAt: "2026-09-01T00:00:00.000Z" }),
        sellIntent: sell(),
        ownershipCondition: "lightly_used",
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it("allows compatible live demand", () => {
    expect(
      canCreateMatch({
        demand: demand(),
        sellIntent: sell(),
        ownershipCondition: "lightly_used",
        nowMs: NOW,
      }),
    ).toBe(true);
  });
});

describe("demand uniqueness + seeker aggregation", () => {
  it("prevents duplicate ACTIVE demand for same user/product via upsert", () => {
    const first = demand({ id: "d-a", userId: "u1", details: { productId: "p1", maxPrice: 1_000_000, conditionPreference: "any", tradeMethod: "any" } });
    const second = demand({
      id: "d-b",
      userId: "u1",
      details: { productId: "p1", maxPrice: 1_200_000, conditionPreference: "sealed", tradeMethod: "any" },
    });
    const list = upsertActiveDemand(upsertActiveDemand([], first), second);
    const active = list.filter(
      (d) => d.userId === "u1" && d.type === "BUY" && d.status === "ACTIVE",
    );
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe("d-a");
    expect(active[0]?.type === "BUY" && active[0].details.maxPrice).toBe(1_200_000);
  });

  it("counts unique seekers, not demand rows", () => {
    const demands = [
      demand({ id: "1", userId: "a", details: { productId: "p1", maxPrice: 100, conditionPreference: "any", tradeMethod: "any" } }),
      demand({ id: "2", userId: "a", details: { productId: "p1", maxPrice: 200, conditionPreference: "any", tradeMethod: "any" } }),
      demand({ id: "3", userId: "b", details: { productId: "p1", maxPrice: 300, conditionPreference: "any", tradeMethod: "any" } }),
    ];
    const agg = aggregateDemands("p1", demands, { nowMs: NOW });
    expect(agg?.seekerCount).toBe(2);
  });
});

describe("sell intent uniqueness", () => {
  it("updates existing OPEN sell intent for same ownership", () => {
    const first = sell({ id: "s-old", minimumPrice: 1_000_000 });
    const second = sell({ id: "s-new", minimumPrice: 1_500_000 });
    const once = upsertOpenSellIntent([], first);
    const twice = upsertOpenSellIntent(once.list, second);
    const open = twice.list.filter((s) => s.ownershipId === "o1" && s.status === "OPEN");
    expect(open).toHaveLength(1);
    expect(open[0]?.id).toBe("s-old");
    expect(open[0]?.minimumPrice).toBe(1_500_000);
  });
});

describe("match lifecycle", () => {
  const potential: Match = {
    id: "potential::d1::s1",
    demandId: "d1",
    sellIntentId: "s1",
    productId: "p1",
    buyerId: "buyer",
    sellerId: "seller",
    status: "POTENTIAL",
    createdAt: "2026-09-13T00:00:00.000Z",
  };

  it("seller cannot connect POTENTIAL match", () => {
    expect(canSellerConnect(potential, "seller")).toBe(false);
    expect(transitionSellerConnect(potential, "seller")).toBeNull();
  });

  it("buyer interest then seller connect is allowed", () => {
    expect(canExpressBuyerInterest(potential, "buyer")).toBe(true);
    const interested = transitionBuyerInterest(potential, "buyer");
    expect(interested?.status).toBe("BUYER_INTERESTED");
    expect(canSellerConnect(interested!, "seller")).toBe(true);
    expect(transitionSellerConnect(interested!, "seller")?.status).toBe("CONNECTED");
  });

  it("keeps POTENTIAL derived and progressive matches persisted in merge", () => {
    const own = ownership();
    const candidates = listMatchCandidates({
      demands: [demand()],
      sellIntents: [sell()],
      ownershipById: new Map([
        [own.id, { condition: own.condition, status: own.status, userId: own.userId }],
      ]),
      nowMs: NOW,
    });
    expect(candidates).toHaveLength(1);
    const persisted: Match[] = [{ ...potential, id: "match-persisted", status: "BUYER_INTERESTED" }];
    const visible = mergeVisibleMatches({
      persisted,
      candidates,
      userId: "buyer",
      nowIso: new Date(NOW).toISOString(),
    });
    expect(visible).toHaveLength(1);
    expect(visible[0]?.status).toBe("BUYER_INTERESTED");
  });
});

describe("feed generalization", () => {
  const product: Product = {
    id: "p1",
    name: "Phone",
    brand: "A",
    model: "Phone",
    category: "electronics",
    imageHue: 200,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("classifies aggregated vs individual", () => {
    const feed = buildFeedItems(
      [product],
      [
        demand(),
        {
          id: "t1",
          userId: "u2",
          type: "TASK",
          title: "Pickup",
          description: "Pickup",
          category: "errand",
          budget: 20000,
          fulfillmentOptions: [{ mode: "REMOTE" as const }],
          status: "ACTIVE",
          createdAt: "2026-09-13T00:00:00.000Z",
          expiresAt: "2026-09-20T00:00:00.000Z",
          details: { taskDescription: "Pickup" },
        },
      ],
      { nowMs: NOW },
    );
    expect(feed.some((f) => classifyFeedItem(f) === "aggregated")).toBe(true);
    expect(feed.some((f) => classifyFeedItem(f) === "individual")).toBe(true);
  });

  it("allows response to foreign live demand", () => {
    const task = {
      id: "t1",
      userId: "owner",
      type: "TASK" as const,
      title: "Pickup",
      description: "Pickup",
      category: "errand" as const,
      budget: 20000,
      fulfillmentOptions: [{ mode: "REMOTE" as const }],
      status: "ACTIVE" as const,
      createdAt: "2026-09-13T00:00:00.000Z",
      expiresAt: "2026-09-20T00:00:00.000Z",
      details: { taskDescription: "Pickup" },
    };
    expect(canRespondToDemand(task, "helper", NOW)).toBe(true);
    expect(canRespondToDemand(task, "owner", NOW)).toBe(false);
  });
});
