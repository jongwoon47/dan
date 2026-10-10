import type { Demand, DemandType } from "./types";
import {
  matchesLocationDiscovery,
  type LocationDiscoveryFilter,
} from "./locationDiscovery";

/** Spec design name: rankEligibleRequests — client-side ranking over server-eligible rows. */
export type PhysicalDiscoverySort = "nearest" | "newest" | "relevance";

export type RankableDemand = Pick<
  Demand,
  "id" | "type" | "createdAt" | "countryCode" | "fulfillmentOptions" | "status"
>;

export type RankEligibleOptions = {
  marketCountry: "KR" | "JP";
  requestType?: "all" | DemandType;
  location: LocationDiscoveryFilter;
  sort: PhysicalDiscoverySort;
  approximateMetersById: Record<string, number>;
};

/**
 * Filter demands already returned by discovery RPCs / feed, then sort.
 * Does not invent distances or bypass server country/auth/block gates.
 */
export function rankEligibleRequests<T extends RankableDemand>(
  demands: T[],
  options: RankEligibleOptions,
): T[] {
  const typeOk = (demand: T) =>
    options.requestType == null ||
    options.requestType === "all" ||
    demand.type === options.requestType;

  const eligible = demands.filter(
    (demand) =>
      (demand.countryCode ?? "KR") === options.marketCountry &&
      demand.status === "ACTIVE" &&
      typeOk(demand) &&
      matchesLocationDiscovery(demand, options.location),
  );

  return eligible.sort((a, b) => {
    if (options.sort === "nearest") {
      const da = options.approximateMetersById[a.id] ?? Number.POSITIVE_INFINITY;
      const db = options.approximateMetersById[b.id] ?? Number.POSITIVE_INFINITY;
      return da - db || b.createdAt.localeCompare(a.createdAt);
    }
    if (options.sort === "relevance") {
      // Without a dedicated scorer: prefer nearer, then newer (stable interim).
      const da = options.approximateMetersById[a.id] ?? Number.POSITIVE_INFINITY;
      const db = options.approximateMetersById[b.id] ?? Number.POSITIVE_INFINITY;
      if (Number.isFinite(da) || Number.isFinite(db)) {
        return da - db || b.createdAt.localeCompare(a.createdAt);
      }
      return b.createdAt.localeCompare(a.createdAt);
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}
