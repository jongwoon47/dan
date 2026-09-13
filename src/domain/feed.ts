import type { Demand, FeedItem, Product } from "./types";
import { isBuyDemand, isIndividualDemandType } from "./types";
import { isDemandLive } from "./demands";
import {
  aggregateDemands,
  listDemandAggregates,
} from "./aggregation";

export interface BuildFeedOptions {
  nowMs?: number;
  displaySeekerOverrides?: Record<string, number>;
  displayRecentDeltaFloor?: Record<string, number>;
}

function applyDisplayOverride(
  agg: ReturnType<typeof aggregateDemands> & object,
  overrides?: Record<string, number>,
  recentFloor?: Record<string, number>,
) {
  if (!agg) return null;
  return {
    ...agg,
    seekerCount: overrides?.[agg.productId] ?? agg.seekerCount,
    recent7dDelta:
      recentFloor?.[agg.productId] == null
        ? agg.recent7dDelta
        : Math.max(agg.recent7dDelta, recentFloor[agg.productId]!),
  };
}

/**
 * Mixed feed: aggregated BUY products + individual non-BUY demands.
 * Aggregated rows use unique-seeker domain counts (+ optional demo overrides).
 */
export function buildFeedItems(
  products: Product[],
  demands: Demand[],
  options: BuildFeedOptions = {},
): FeedItem[] {
  const nowMs = options.nowMs ?? Date.now();
  const aggregated = listDemandAggregates(products, demands, { nowMs })
    .map((row) => {
      const agg = applyDisplayOverride(
        row,
        options.displaySeekerOverrides,
        options.displayRecentDeltaFloor,
      );
      if (!agg) return null;
      return {
        kind: "aggregated" as const,
        id: `agg:${row.product.id}`,
        product: row.product,
        aggregate: agg,
      };
    })
    .filter((x): x is Extract<FeedItem, { kind: "aggregated" }> => x != null);

  const individual = demands
    .filter(
      (d) => isIndividualDemandType(d.type) && isDemandLive(d, nowMs),
    )
    .map((demand) => ({
      kind: "individual" as const,
      id: `demand:${demand.id}`,
      demand,
    }));

  const merged: FeedItem[] = [...aggregated, ...individual];
  return merged.sort((a, b) => {
    const aTime =
      a.kind === "aggregated"
        ? a.aggregate.recent7dDelta * 1_000_000 + a.aggregate.seekerCount
        : new Date(a.demand.createdAt).getTime();
    const bTime =
      b.kind === "aggregated"
        ? b.aggregate.recent7dDelta * 1_000_000 + b.aggregate.seekerCount
        : new Date(b.demand.createdAt).getTime();
    return bTime - aTime;
  });
}

export function classifyFeedItem(item: FeedItem): "aggregated" | "individual" {
  return item.kind;
}

export function buyDemandsForProduct(
  demands: Demand[],
  productId: string,
  nowMs = Date.now(),
): Demand[] {
  return demands.filter(
    (d) =>
      isBuyDemand(d) &&
      d.details.productId === productId &&
      isDemandLive(d, nowMs),
  );
}
