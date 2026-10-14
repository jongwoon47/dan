import type { Demand } from "./types";
import type { FulfillmentOption, Place } from "./fulfillment";

/**
 * Design name: searchRouteCandidates.
 * Client-side FROM→TO label matching for ROUTE fulfillment. Never invents
 * ETA/detour minutes unless a RouteMetricsProvider returns real data.
 */

export type RouteCandidateDemand = Pick<
  Demand,
  "id" | "fulfillmentOptions" | "createdAt" | "status"
>;

export type RouteMetrics = {
  /** Present only when a real routing provider computed it. */
  etaMinutes: number | null;
  /** Present only when a real routing provider computed it. */
  detourMinutes: number | null;
  available: boolean;
};

export type RouteMetricsQuery = {
  routeFrom: string;
  routeTo: string;
  demandFrom: Place;
  demandTo: Place;
};

export interface RouteMetricsProvider {
  getMetrics(query: RouteMetricsQuery): RouteMetrics | Promise<RouteMetrics>;
}

/** Default provider: no ETA/detour. Used until a real routing service is approved. */
export class NullRouteMetricsProvider implements RouteMetricsProvider {
  getMetrics(_query: RouteMetricsQuery): RouteMetrics {
    return { etaMinutes: null, detourMinutes: null, available: false };
  }
}

export type RankedRouteCandidate<T extends RouteCandidateDemand> = {
  demand: T;
  /** Higher = more specific label match (exact > substring). */
  specificityScore: number;
  metricsAvailable: boolean;
  etaMinutes: number | null;
  detourMinutes: number | null;
};

export type RankRouteCandidatesOptions = {
  routeFrom: string;
  routeTo: string;
  metricsProvider?: RouteMetricsProvider;
};

function normalizeLabel(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

/** Score how specifically a stored label matches a search query. 0 = no match. */
export function labelSpecificityScore(label: string, query: string): number {
  const normalizedLabel = normalizeLabel(label);
  const normalizedQuery = normalizeLabel(query);
  if (!normalizedLabel || !normalizedQuery) return 0;
  if (normalizedLabel === normalizedQuery) return 100;
  if (normalizedLabel.includes(normalizedQuery) || normalizedQuery.includes(normalizedLabel)) {
    const shorter = Math.min(normalizedLabel.length, normalizedQuery.length);
    const longer = Math.max(normalizedLabel.length, normalizedQuery.length);
    // Prefer tighter overlaps (more specific) over loose substring hits.
    return 40 + Math.round((shorter / longer) * 50);
  }
  return 0;
}

function placeSpecificityScore(place: Place, query: string): number {
  const labelScore = labelSpecificityScore(place.publicLabel, query);
  const regionScore = place.region2 ? labelSpecificityScore(place.region2, query) : 0;
  return Math.max(labelScore, regionScore);
}

function routeOptionEndpoints(
  option: FulfillmentOption,
): { from: Place; to: Place } | null {
  if (option.mode !== "ROUTE") return null;
  return { from: option.from, to: option.to };
}

/**
 * Best directional FROM→TO specificity for a demand's ROUTE options.
 * Returns 0 when no option matches both ends.
 */
export function routeMatchSpecificity(
  demand: RouteCandidateDemand,
  routeFrom: string,
  routeTo: string,
): number {
  const fromQ = normalizeLabel(routeFrom);
  const toQ = normalizeLabel(routeTo);
  if (!fromQ || !toQ) return 0;

  let best = 0;
  for (const option of demand.fulfillmentOptions) {
    const ends = routeOptionEndpoints(option);
    if (!ends) continue;
    const fromScore = placeSpecificityScore(ends.from, routeFrom);
    const toScore = placeSpecificityScore(ends.to, routeTo);
    if (fromScore <= 0 || toScore <= 0) continue;
    best = Math.max(best, fromScore + toScore);
  }
  return best;
}

/** Filter demands that declare a matching ROUTE FROM→TO (design: searchRouteCandidates). */
export function searchRouteCandidates<T extends RouteCandidateDemand>(
  demands: T[],
  routeFrom: string,
  routeTo: string,
): T[] {
  return demands.filter((demand) => routeMatchSpecificity(demand, routeFrom, routeTo) > 0);
}

/**
 * Rank ROUTE candidates by label specificity, then optional real metrics.
 * With NullRouteMetricsProvider (default), metricsAvailable is always false
 * and eta/detour stay null — never fabricated.
 */
export async function rankRouteCandidates<T extends RouteCandidateDemand>(
  demands: T[],
  options: RankRouteCandidatesOptions,
): Promise<Array<RankedRouteCandidate<T>>> {
  const provider = options.metricsProvider ?? new NullRouteMetricsProvider();
  const matched = searchRouteCandidates(demands, options.routeFrom, options.routeTo);

  const ranked: Array<RankedRouteCandidate<T>> = [];
  for (const demand of matched) {
    const specificityScore = routeMatchSpecificity(
      demand,
      options.routeFrom,
      options.routeTo,
    );
    let metricsAvailable = false;
    let etaMinutes: number | null = null;
    let detourMinutes: number | null = null;

    const routeOpt = demand.fulfillmentOptions.find((o) => o.mode === "ROUTE");
    if (routeOpt && routeOpt.mode === "ROUTE") {
      const metrics = await provider.getMetrics({
        routeFrom: options.routeFrom,
        routeTo: options.routeTo,
        demandFrom: routeOpt.from,
        demandTo: routeOpt.to,
      });
      if (metrics.available) {
        metricsAvailable = true;
        etaMinutes = metrics.etaMinutes;
        detourMinutes = metrics.detourMinutes;
      }
    }

    ranked.push({
      demand,
      specificityScore,
      metricsAvailable,
      etaMinutes,
      detourMinutes,
    });
  }

  ranked.sort((a, b) => {
    if (a.metricsAvailable && b.metricsAvailable) {
      const detourA = a.detourMinutes ?? Number.POSITIVE_INFINITY;
      const detourB = b.detourMinutes ?? Number.POSITIVE_INFINITY;
      if (detourA !== detourB) return detourA - detourB;
    } else if (a.metricsAvailable !== b.metricsAvailable) {
      return a.metricsAvailable ? -1 : 1;
    }
    return (
      b.specificityScore - a.specificityScore ||
      b.demand.createdAt.localeCompare(a.demand.createdAt)
    );
  });

  return ranked;
}

/**
 * Sync ranking with NullRouteMetricsProvider semantics.
 * Prefer this in React useMemo; use async rankRouteCandidates when a real provider exists.
 */
export function rankRouteCandidatesSync<T extends RouteCandidateDemand>(
  demands: T[],
  options: Omit<RankRouteCandidatesOptions, "metricsProvider">,
): Array<RankedRouteCandidate<T>> {
  const matched = searchRouteCandidates(demands, options.routeFrom, options.routeTo);
  return matched
    .map((demand) => ({
      demand,
      specificityScore: routeMatchSpecificity(
        demand,
        options.routeFrom,
        options.routeTo,
      ),
      metricsAvailable: false,
      etaMinutes: null,
      detourMinutes: null,
    }))
    .sort(
      (a, b) =>
        b.specificityScore - a.specificityScore ||
        b.demand.createdAt.localeCompare(a.demand.createdAt),
    );
}
