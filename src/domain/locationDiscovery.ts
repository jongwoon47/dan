import { collectRegion2Keys, hasRemoteOption, hasShippingOption } from "./fulfillment";
import type { Demand } from "./types";

export type LocationDiscoveryMode = "all" | "nearby" | "area" | "online" | "route";
export type LocationDemand = Pick<Demand, "id" | "fulfillmentOptions">;

export type LocationDiscoveryFilter = {
  mode: LocationDiscoveryMode;
  radiusKm: number;
  areaQuery: string;
  routeFrom?: string;
  routeTo?: string;
  /** Approximate server-computed distance only. Never query public raw coordinates. */
  approximateMetersById: Record<string, number>;
};

export function hasPhysicalFulfillment(demand: LocationDemand): boolean {
  return demand.fulfillmentOptions.some(
    (option) =>
      option.mode === "MEETUP" ||
      option.mode === "ONSITE" ||
      option.mode === "PICKUP" ||
      option.mode === "ROUTE",
  );
}

function normalizeArea(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

/**
 * Physical requests without server-calculated distance are excluded from GPS
 * radius mode, not assigned a guessed distance or a fabricated map pin.
 * Text area matching is explicitly approximate and never labeled "km".
 */
export function matchesLocationDiscovery(
  demand: LocationDemand,
  filter: LocationDiscoveryFilter,
): boolean {
  const options = demand.fulfillmentOptions;
  switch (filter.mode) {
    case "all":
      return true;
    case "online":
      return hasRemoteOption(options) || hasShippingOption(options);
    case "area": {
      const query = normalizeArea(filter.areaQuery);
      if (!query || !hasPhysicalFulfillment(demand)) return false;
      return collectRegion2Keys(options).some((candidate) => {
        const value = normalizeArea(candidate);
        return value.length > 0 && (value.includes(query) || query.includes(value));
      });
    }
    case "route": {
      const from = normalizeArea(filter.routeFrom ?? "");
      const to = normalizeArea(filter.routeTo ?? "");
      if (!from || !to) return false;
      return options.some((option) => {
        if (option.mode !== "ROUTE") return false;
        const matches = (label: string, query: string) => {
          const normalized = normalizeArea(label);
          return normalized.length > 0 &&
            (normalized.includes(query) || query.includes(normalized));
        };
        const atEnd = (place: { publicLabel: string; region2?: string }, query: string) =>
          matches(place.publicLabel, query) || (place.region2 ? matches(place.region2, query) : false);
        return atEnd(option.from, from) && atEnd(option.to, to);
      });
    }
    case "nearby": {
      if (!hasPhysicalFulfillment(demand)) return false;
      const meters = filter.approximateMetersById[demand.id];
      return Number.isFinite(meters) && meters >= 0 &&
        Number.isFinite(filter.radiusKm) && filter.radiusKm > 0 &&
        meters <= filter.radiusKm * 1000;
    }
  }
}

export function distanceRequestBatches(ids: string[], maxBatchSize = 40): string[][] {
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 40) {
    throw new Error("distance RPC batch size must be between 1 and 40");
  }
  const unique = [...new Set(ids.filter(Boolean))];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += maxBatchSize) {
    batches.push(unique.slice(i, i + maxBatchSize));
  }
  return batches;
}
