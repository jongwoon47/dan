import type { Demand, FeedItem, Product } from "./types";
import { isBuyDemand, isIndividualDemandType } from "./types";
import { isDemandLive } from "./demands";
import { listDemandAggregates } from "./aggregation";
import type { FeedAreaFilter } from "./fulfillment";
import { matchesFeedAreaFilter } from "./fulfillment";

export interface BuildFeedOptions {
  nowMs?: number;
  displaySeekerOverrides?: Record<string, number>;
  displayRecentDeltaFloor?: Record<string, number>;
  areaFilter?: FeedAreaFilter;
  viewerDefaultArea?: string;
}

function applyDisplayOverride(
  agg: ReturnType<typeof listDemandAggregates>[number],
  overrides?: Record<string, number>,
  recentFloor?: Record<string, number>,
) {
  return {
    ...agg,
    seekerCount: overrides?.[agg.productId] ?? agg.seekerCount,
    recent7dDelta:
      recentFloor?.[agg.productId] == null
        ? agg.recent7dDelta
        : Math.max(agg.recent7dDelta, recentFloor[agg.productId]!),
  };
}

function latestBuyCreatedAt(
  demands: Demand[],
  productId: string,
  nowMs: number,
): string {
  let latest = 0;
  let latestIso = new Date(0).toISOString();
  for (const d of demands) {
    if (!isBuyDemand(d) || d.details.productId !== productId) continue;
    if (!isDemandLive(d, nowMs)) continue;
    const t = new Date(d.createdAt).getTime();
    if (t >= latest) {
      latest = t;
      latestIso = d.createdAt;
    }
  }
  return latestIso;
}

/**
 * Mixed feed: aggregated BUY + individual non-BUY.
 * Ranking uses the same time axis (createdAt / latest BUY createdAt)
 * so aggregated rows are not permanently buried or pinned by a different scale.
 */
export function buildFeedItems(
  products: Product[],
  demands: Demand[],
  options: BuildFeedOptions = {},
): FeedItem[] {
  const nowMs = options.nowMs ?? Date.now();
  const areaFilter = options.areaFilter ?? "all";
  const viewerDefaultArea = options.viewerDefaultArea ?? "";

  const aggregated = listDemandAggregates(products, demands, { nowMs })
    .map((row) => {
      const agg = applyDisplayOverride(
        row,
        options.displaySeekerOverrides,
        options.displayRecentDeltaFloor,
      );
      const buyRows = demands.filter(
        (d) =>
          isBuyDemand(d) &&
          d.details.productId === row.product.id &&
          isDemandLive(d, nowMs),
      );
      if (
        areaFilter !== "all" &&
        !buyRows.some((d) =>
          matchesFeedAreaFilter(d.fulfillmentOptions, areaFilter, viewerDefaultArea),
        )
      ) {
        return null;
      }
      const { product, ...aggregate } = agg;
      return {
        kind: "aggregated" as const,
        id: `agg:${product.id}`,
        product,
        aggregate,
        sortAt: latestBuyCreatedAt(demands, product.id, nowMs),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const individual = demands
    .filter(
      (d) =>
        isIndividualDemandType(d.type) &&
        isDemandLive(d, nowMs) &&
        matchesFeedAreaFilter(d.fulfillmentOptions, areaFilter, viewerDefaultArea),
    )
    .map((demand) => ({
      kind: "individual" as const,
      id: `demand:${demand.id}`,
      demand,
      sortAt: demand.createdAt,
    }));

  const merged: FeedItem[] = [...aggregated, ...individual];
  return merged.sort((a, b) => {
    const aTime = new Date(a.sortAt).getTime();
    const bTime = new Date(b.sortAt).getTime();
    if (bTime !== aTime) return bTime - aTime;
    // Stable tie-break: prefer higher seeker activity for aggregates, else id.
    const aBoost =
      a.kind === "aggregated" ? a.aggregate.seekerCount : 0;
    const bBoost =
      b.kind === "aggregated" ? b.aggregate.seekerCount : 0;
    if (bBoost !== aBoost) return bBoost - aBoost;
    return a.id.localeCompare(b.id);
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
