import { ko } from "@/copy/ko";
import {
  aggregateDemands as aggregateDemandsDomain,
  listDemandAggregates as listDemandAggregatesDomain,
} from "./aggregation";
import type {
  Demand,
  DemandAggregate,
  Match,
  Ownership,
  Product,
  SellIntent,
  User,
} from "./types";

export const DEMO_USERS: User[] = [
  { id: "user-mina", name: ko.mina, location: ko.seongdong },
  { id: "user-jun", name: ko.jun, location: ko.mapo },
  { id: "user-hae", name: ko.hae, location: ko.haeundae },
  { id: "user-you", name: ko.you, location: ko.gangnam },
];

export const CURRENT_USER_ID = "user-you";

export const PRODUCTS: Product[] = [
  { id: "prod-sony-2470-gm2", name: "Sony FE 24-70mm F2.8 GM II", brand: "Sony", model: "FE 24-70mm F2.8 GM II", category: "lens", imageHue: 210, createdAt: "2026-01-10T00:00:00.000Z" },
  { id: "prod-fuji-x100vi", name: "Fujifilm X100VI", brand: "Fujifilm", model: "X100VI", category: "camera", imageHue: 28, createdAt: "2026-01-12T00:00:00.000Z" },
  { id: "prod-canon-70200", name: "Canon RF 70-200mm F2.8 L IS USM", brand: "Canon", model: "RF 70-200mm F2.8 L IS USM", category: "lens", imageHue: 0, createdAt: "2026-01-14T00:00:00.000Z" },
  { id: "prod-sony-a7c2", name: "Sony A7C II", brand: "Sony", model: "A7C II", category: "camera", imageHue: 195, createdAt: "2026-01-16T00:00:00.000Z" },
  { id: "prod-ricoh-griiix", name: "Ricoh GR IIIx", brand: "Ricoh", model: "GR IIIx", category: "camera", imageHue: 145, createdAt: "2026-01-18T00:00:00.000Z" },
  { id: "prod-apple-m4-pro", name: "MacBook Pro 14 M4 Pro", brand: "Apple", model: "MacBook Pro 14 M4 Pro", category: "electronics", imageHue: 250, createdAt: "2026-01-20T00:00:00.000Z" },
  { id: "prod-dji-mini4", name: "DJI Mini 4 Pro", brand: "DJI", model: "Mini 4 Pro", category: "electronics", imageHue: 170, createdAt: "2026-01-22T00:00:00.000Z" },
  { id: "prod-leica-q3", name: "Leica Q3", brand: "Leica", model: "Q3", category: "camera", imageHue: 40, createdAt: "2026-01-24T00:00:00.000Z" },
];

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Seed demands use unique synthetic seeker ids so domain seekerCount
 * (unique userId) stays meaningful without relying on display overrides.
 */
function priceSet(productId: string, entries: Array<[number, number]>): Demand[] {
  const conditions: Demand["conditionPreference"][] = [
    "any",
    "like_new",
    "lightly_used",
    "sealed",
    "any",
  ];
  const locations = [ko.seoul, ko.gyeonggi, ko.busan, ko.daegu, ko.incheon];
  const methods: Demand["tradeMethod"][] = ["any", "meetup", "shipping"];
  return entries.map(([maxPrice, days], index) => ({
    id: "demand-" + productId + "-" + index,
    userId: `seeker-${productId}-${index}`,
    productId,
    maxPrice,
    conditionPreference: conditions[index % conditions.length]!,
    location: locations[index % locations.length]!,
    tradeMethod: methods[index % methods.length]!,
    status: "ACTIVE" as const,
    createdAt: daysAgo(days),
    expiresAt: daysFromNow(30 - (days % 10)),
  }));
}

export const SEED_DEMANDS: Demand[] = [
  ...priceSet("prod-sony-2470-gm2", [[1500000,20],[1550000,18],[1620000,14],[1650000,12],[1680000,10],[1700000,9],[1720000,8],[1740000,7],[1750000,6],[1760000,5],[1780000,4],[1800000,3],[1820000,2],[1840000,2],[1850000,1],[1700000,1],[1730000,0]]),
  ...priceSet("prod-fuji-x100vi", [[2400000,20],[2450000,18],[2500000,15],[2520000,12],[2550000,10],[2580000,8],[2600000,7],[2650000,6],[2680000,5],[2700000,4],[2720000,3],[2750000,2],[2780000,1],[2800000,1],[2480000,0]]),
  ...priceSet("prod-canon-70200", [[2100000,16],[2150000,12],[2180000,10],[2200000,8],[2220000,6],[2250000,4],[2300000,3],[2320000,2],[2350000,1]]),
  ...priceSet("prod-sony-a7c2", [[1750000,18],[1780000,14],[1800000,11],[1820000,9],[1850000,7],[1870000,5],[1900000,4],[1920000,3],[1940000,2],[1950000,1],[1830000,0],[1860000,1],[1880000,2],[1910000,3]]),
  ...priceSet("prod-ricoh-griiix", [[1350000,19],[1380000,15],[1400000,12],[1420000,10],[1440000,8],[1460000,6],[1480000,5],[1500000,4],[1520000,3],[1540000,2],[1550000,1],[1430000,0],[1450000,1],[1470000,2],[1490000,2],[1510000,3],[1530000,4],[1390000,5],[1410000,6],[1360000,7],[1370000,0],[1545000,1]]),
  ...priceSet("prod-apple-m4-pro", [[2800000,14],[2900000,10],[3000000,7],[3100000,4],[3200000,2],[2950000,1]]),
  ...priceSet("prod-dji-mini4", [[980000,11],[1020000,8],[1050000,5],[1080000,3],[1100000,1]]),
  ...priceSet("prod-leica-q3", [[6200000,21],[6400000,14],[6500000,9],[6700000,5],[6800000,2]]),
];

/**
 * DEMO DISPLAY ONLY ? never import into production domain logic.
 * Inflates seekerCount for a few products in the local V0 UI.
 */
export const DISPLAY_SEEKER_OVERRIDES: Record<string, number> = {
  "prod-fuji-x100vi": 31,
};

/** DEMO DISPLAY ONLY ? floor recent delta for Sony feed storytelling. */
const DISPLAY_RECENT_DELTA_FLOOR: Record<string, number> = {
  "prod-sony-2470-gm2": 4,
};

export const SEED_OWNERSHIPS: Ownership[] = [
  {
    id: "own-jun-2470",
    userId: "user-jun",
    productId: "prod-sony-2470-gm2",
    condition: "lightly_used",
    status: "OWNED",
    createdAt: daysAgo(40),
  },
];

export const SEED_SELL_INTENTS: SellIntent[] = [
  {
    id: "sell-jun-2470",
    ownershipId: "own-jun-2470",
    userId: "user-jun",
    productId: "prod-sony-2470-gm2",
    minimumPrice: 1800000,
    status: "OPEN",
    createdAt: daysAgo(2),
  },
];

/** Persisted progressive matches only; POTENTIAL is derived at runtime. */
export const SEED_MATCHES: Match[] = [];

function applyDemoDisplayOverride(agg: DemandAggregate): DemandAggregate {
  const seekerOverride = DISPLAY_SEEKER_OVERRIDES[agg.productId];
  const recentFloor = DISPLAY_RECENT_DELTA_FLOOR[agg.productId];
  return {
    ...agg,
    seekerCount: seekerOverride ?? agg.seekerCount,
    recent7dDelta:
      recentFloor == null
        ? agg.recent7dDelta
        : Math.max(agg.recent7dDelta, recentFloor),
  };
}

/** Domain aggregate (unique seekers). No display overrides. */
export function aggregateDemandsDomainOnly(
  productId: string,
  demands: Demand[],
  nowMs?: number,
): DemandAggregate | null {
  return aggregateDemandsDomain(productId, demands, { nowMs });
}

/**
 * Demo feed helper: domain aggregate + isolated display overrides.
 * Production backend must use aggregateDemandsDomainOnly / aggregation.ts.
 */
export function aggregateDemands(
  productId: string,
  demands: Demand[],
  nowMs?: number,
): DemandAggregate | null {
  const agg = aggregateDemandsDomain(productId, demands, { nowMs });
  return agg ? applyDemoDisplayOverride(agg) : null;
}

export function listDemandAggregates(
  products: Product[],
  demands: Demand[],
  nowMs?: number,
): Array<DemandAggregate & { product: Product }> {
  return listDemandAggregatesDomain(products, demands, { nowMs }).map((row) => ({
    ...applyDemoDisplayOverride(row),
    product: row.product,
  }));
}
