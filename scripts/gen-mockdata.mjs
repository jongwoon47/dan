import fs from "node:fs";

const content = `import { ko } from "@/copy/ko";
import type {
  Demand,
  DemandAggregate,
  Match,
  Ownership,
  PriceBucket,
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

function priceSet(productId: string, entries: Array<[number, number]>): Demand[] {
  const conditions: Demand["conditionPreference"][] = ["any", "like_new", "lightly_used", "sealed", "any"];
  const locations = [ko.seoul, ko.gyeonggi, ko.busan, ko.daegu, ko.incheon];
  const methods: Demand["tradeMethod"][] = ["any", "meetup", "shipping"];
  const users = ["user-mina", "user-jun", "user-hae"];
  return entries.map(([maxPrice, days], index) => ({
    id: "demand-" + productId + "-" + index,
    userId: users[index % users.length]!,
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

export const DISPLAY_SEEKER_OVERRIDES: Record<string, number> = { "prod-fuji-x100vi": 31 };

export const SEED_OWNERSHIPS: Ownership[] = [
  { id: "own-jun-2470", userId: "user-jun", productId: "prod-sony-2470-gm2", condition: "lightly_used", status: "OWNED", createdAt: daysAgo(40) },
];

export const SEED_SELL_INTENTS: SellIntent[] = [
  { id: "sell-jun-2470", ownershipId: "own-jun-2470", userId: "user-jun", productId: "prod-sony-2470-gm2", minimumPrice: 1800000, status: "OPEN", createdAt: daysAgo(2) },
];

export const SEED_MATCHES: Match[] = [];

function formatBucketLabel(min: number, max: number): string {
  const toMan = (n: number) => Math.round(n / 10000) + ko.manWon;
  return toMan(min) + "~" + toMan(max);
}

function buildBuckets(prices: number[]): PriceBucket[] {
  if (prices.length === 0) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const span = Math.max(max - min, 100000);
  const step = Math.max(Math.round(span / 4 / 50000) * 50000, 50000);
  const start = Math.floor(min / step) * step;
  const buckets: PriceBucket[] = [];
  for (let edge = start; edge <= max; edge += step) {
    const next = edge + step;
    const count = prices.filter((p) => p >= edge && p < next).length;
    buckets.push({ label: formatBucketLabel(edge, next), count, min: edge, max: next });
  }
  return buckets.filter((b, i, arr) => b.count > 0 || i === 0 || i === arr.length - 1);
}

export function aggregateDemands(productId: string, demands: Demand[]): DemandAggregate | null {
  const active = demands.filter((d) => d.productId === productId && d.status === "ACTIVE");
  if (active.length === 0) return null;
  const prices = active.map((d) => d.maxPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent7dDelta = active.filter((d) => new Date(d.createdAt).getTime() >= weekAgo).length;
  return {
    productId,
    seekerCount: DISPLAY_SEEKER_OVERRIDES[productId] ?? active.length,
    minPrice,
    maxPrice,
    avgPrice,
    recent7dDelta: productId === "prod-sony-2470-gm2" ? Math.max(recent7dDelta, 4) : recent7dDelta,
    highestIntentPrice: maxPrice,
    priceBuckets: buildBuckets(prices),
  };
}

export function listDemandAggregates(products: Product[], demands: Demand[]): Array<DemandAggregate & { product: Product }> {
  return products
    .map((product) => {
      const agg = aggregateDemands(product.id, demands);
      return agg ? { ...agg, product } : null;
    })
    .filter((row): row is DemandAggregate & { product: Product } => row != null)
    .sort((a, b) => b.seekerCount - a.seekerCount);
}
`;

fs.writeFileSync("src/domain/mockData.ts", content, "utf8");
console.log("wrote mockData", content.length);
