import type { Demand, DemandAggregate } from "@/domain/types";
import { aggregateDemands } from "@/domain/aggregation";

/**
 * Unify remote BUY aggregate stats with client-computed buckets/fulfillment.
 * Remote views often omit priceBuckets; live demands remain the source of truth
 * for distribution and fulfillment summary.
 */
export function mergeBuyAggregate(
  productId: string,
  demands: Demand[],
  remote: DemandAggregate | null | undefined,
): DemandAggregate | null {
  const local = aggregateDemands(productId, demands);
  if (!local && !remote) return null;
  if (local && !remote) return local;
  if (!local && remote) return remote;

  return {
    productId,
    seekerCount: Math.max(local!.seekerCount, remote!.seekerCount),
    minPrice:
      remote!.minPrice > 0
        ? Math.min(local!.minPrice, remote!.minPrice)
        : local!.minPrice,
    maxPrice: Math.max(local!.maxPrice, remote!.maxPrice),
    avgPrice: local!.avgPrice || remote!.avgPrice,
    recent7dDelta: Math.max(local!.recent7dDelta, remote!.recent7dDelta),
    highestIntentPrice: Math.max(
      local!.highestIntentPrice,
      remote!.highestIntentPrice,
    ),
    priceBuckets:
      local!.priceBuckets.length > 0 ? local!.priceBuckets : remote!.priceBuckets,
    fulfillmentSummary:
      local!.fulfillmentSummary ?? remote!.fulfillmentSummary,
  };
}
