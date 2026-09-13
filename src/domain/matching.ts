import type {
  ConditionPreference,
  Demand,
  ItemCondition,
  SellIntent,
  TradeMethod,
} from "./types";

const CONDITION_RANK: Record<ConditionPreference, number> = {
  sealed: 3,
  like_new: 2,
  lightly_used: 1,
  any: 0,
};

/** Ownership condition must meet or exceed the buyer's preference. */
export function isConditionCompatible(
  preference: ConditionPreference,
  ownershipCondition: ItemCondition,
): boolean {
  if (preference === "any") return true;
  return CONDITION_RANK[ownershipCondition] >= CONDITION_RANK[preference];
}

export function isTradeCompatible(
  demandMethod: TradeMethod,
  sellerPrefers?: TradeMethod,
): boolean {
  if (!sellerPrefers || sellerPrefers === "any" || demandMethod === "any") {
    return true;
  }
  return demandMethod === sellerPrefers;
}

export function isPriceCompatible(
  demandMaxPrice: number,
  sellMinimumPrice: number,
): boolean {
  return demandMaxPrice >= sellMinimumPrice;
}

export interface MatchCandidateInput {
  demand: Demand;
  sellIntent: SellIntent;
  ownershipCondition: ItemCondition;
  sameRegionBonus?: boolean;
}

export function canCreateMatch(input: MatchCandidateInput): boolean {
  const { demand, sellIntent, ownershipCondition } = input;
  if (demand.status !== "ACTIVE") return false;
  if (sellIntent.status !== "OPEN") return false;
  if (demand.productId !== sellIntent.productId) return false;
  if (demand.userId === sellIntent.userId) return false;
  if (!isPriceCompatible(demand.maxPrice, sellIntent.minimumPrice)) return false;
  if (!isConditionCompatible(demand.conditionPreference, ownershipCondition)) {
    return false;
  }
  return true;
}
