import type { Demand, DemandAggregate, PriceBucket, Product } from "./types";
import { isBuyDemand } from "./types";
import { isDemandLive } from "./demands";
import { summarizeBuyFulfillment } from "./fulfillment";
import { ko } from "@/copy/ko";

export interface AggregateOptions {
  nowMs?: number;
}

/**
 * Production domain aggregation for BUY demands sharing a productId.
 * seekerCount = unique live seeker userIds. No display overrides.
 */
export function aggregateDemands(
  productId: string,
  demands: Demand[],
  options: AggregateOptions = {},
): DemandAggregate | null {
  const nowMs = options.nowMs ?? Date.now();
  const live = demands.filter(
    (d) =>
      isBuyDemand(d) &&
      d.details.productId === productId &&
      isDemandLive(d, nowMs),
  );
  if (live.length === 0) return null;

  const seekerIds = new Set(live.map((d) => d.userId));
  const prices = live.map((d) => (isBuyDemand(d) ? d.details.maxPrice : 0));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = Math.round(
    prices.reduce((sum, p) => sum + p, 0) / prices.length,
  );
  const weekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const recent7dDelta = live.filter(
    (d) => new Date(d.createdAt).getTime() >= weekAgo,
  ).length;

  return {
    productId,
    seekerCount: seekerIds.size,
    minPrice,
    maxPrice,
    avgPrice,
    recent7dDelta,
    highestIntentPrice: maxPrice,
    priceBuckets: buildBuckets(prices),
    fulfillmentSummary: summarizeBuyFulfillment(
      live.map((d) => d.fulfillmentOptions),
    ),
  };
}

export function listDemandAggregates(
  products: Product[],
  demands: Demand[],
  options: AggregateOptions = {},
): Array<DemandAggregate & { product: Product }> {
  return products
    .map((product) => {
      const agg = aggregateDemands(product.id, demands, options);
      return agg ? { ...agg, product } : null;
    })
    .filter((row): row is DemandAggregate & { product: Product } => row != null)
    .sort((a, b) => b.seekerCount - a.seekerCount);
}

function buildBuckets(prices: number[]): PriceBucket[] {
  if (prices.length === 0) return [];
  const counts = new Map<number, number>();
  for (const price of prices) {
    const band = Math.floor(price / 100_000) * 100_000;
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([min, count]) => ({
      label: `${Math.round(min / 10_000)}${ko.bandSuffix}`,
      count,
      min,
      max: min + 100_000,
    }));
}
