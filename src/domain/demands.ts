import type { BuyDemand, Demand } from "./types";
import { isBuyDemand } from "./types";

/** ACTIVE + not past expiresAt. */
export function isDemandLive(demand: Demand, nowMs: number): boolean {
  if (demand.status !== "ACTIVE") return false;
  return new Date(demand.expiresAt).getTime() > nowMs;
}

export function asBuyDemand(demand: Demand): BuyDemand | null {
  return isBuyDemand(demand) ? demand : null;
}

/**
 * Upsert ACTIVE BUY demand for (userId, productId).
 * Prefer update over creating a second ACTIVE row.
 */
export function upsertActiveDemand(
  demands: Demand[],
  next: BuyDemand,
): Demand[] {
  const existingIndex = demands.findIndex(
    (d) =>
      isBuyDemand(d) &&
      d.userId === next.userId &&
      d.details.productId === next.details.productId &&
      d.status === "ACTIVE",
  );
  if (existingIndex === -1) {
    return [next, ...demands];
  }
  const existing = demands[existingIndex] as BuyDemand;
  const updated: BuyDemand = {
    ...existing,
    title: next.title,
    description: next.description,
    category: next.category,
    budget: next.budget,
    location: next.location,
    expiresAt: next.expiresAt,
    status: "ACTIVE",
    details: { ...existing.details, ...next.details },
  };
  const copy = [...demands];
  copy[existingIndex] = updated;
  return copy;
}

export function findActiveBuyDemand(
  demands: Demand[],
  userId: string,
  productId: string,
): BuyDemand | undefined {
  return demands.find(
    (d): d is BuyDemand =>
      isBuyDemand(d) &&
      d.userId === userId &&
      d.details.productId === productId &&
      d.status === "ACTIVE",
  );
}
