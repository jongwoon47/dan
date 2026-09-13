import type { Demand } from "./types";

/** ACTIVE + not past expiresAt. */
export function isDemandLive(demand: Demand, nowMs: number): boolean {
  if (demand.status !== "ACTIVE") return false;
  return new Date(demand.expiresAt).getTime() > nowMs;
}

/**
 * Upsert ACTIVE demand for (userId, productId).
 * Prefer update over creating a second ACTIVE row.
 */
export function upsertActiveDemand(
  demands: Demand[],
  next: Demand,
): Demand[] {
  const existingIndex = demands.findIndex(
    (d) =>
      d.userId === next.userId &&
      d.productId === next.productId &&
      d.status === "ACTIVE",
  );
  if (existingIndex === -1) {
    return [next, ...demands];
  }
  const existing = demands[existingIndex]!;
  const updated: Demand = {
    ...existing,
    maxPrice: next.maxPrice,
    conditionPreference: next.conditionPreference,
    location: next.location,
    tradeMethod: next.tradeMethod,
    expiresAt: next.expiresAt,
    status: "ACTIVE",
  };
  const copy = [...demands];
  copy[existingIndex] = updated;
  return copy;
}

export function findActiveDemand(
  demands: Demand[],
  userId: string,
  productId: string,
): Demand | undefined {
  return demands.find(
    (d) =>
      d.userId === userId &&
      d.productId === productId &&
      d.status === "ACTIVE",
  );
}
