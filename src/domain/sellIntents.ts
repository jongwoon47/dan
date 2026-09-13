import type { SellIntent } from "./types";

/**
 * At most one OPEN SellIntent per ownership.
 * Existing OPEN intent is updated (price) and returned.
 */
export function upsertOpenSellIntent(
  sellIntents: SellIntent[],
  next: SellIntent,
): { list: SellIntent[]; result: SellIntent } {
  const existingIndex = sellIntents.findIndex(
    (s) => s.ownershipId === next.ownershipId && s.status === "OPEN",
  );
  if (existingIndex === -1) {
    return { list: [next, ...sellIntents], result: next };
  }
  const existing = sellIntents[existingIndex]!;
  const updated: SellIntent = {
    ...existing,
    minimumPrice: next.minimumPrice,
    status: "OPEN",
  };
  const copy = [...sellIntents];
  copy[existingIndex] = updated;
  return { list: copy, result: updated };
}

export function findOpenSellIntent(
  sellIntents: SellIntent[],
  ownershipId: string,
): SellIntent | undefined {
  return sellIntents.find(
    (s) => s.ownershipId === ownershipId && s.status === "OPEN",
  );
}
