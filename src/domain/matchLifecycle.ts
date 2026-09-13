import type { Demand, ItemCondition, Match, SellIntent } from "./types";
import { canCreateMatch } from "./matching";

export interface MatchPairKey {
  demandId: string;
  sellIntentId: string;
}

export function pairKey(demandId: string, sellIntentId: string): string {
  return `${demandId}::${sellIntentId}`;
}

export function potentialMatchId(demandId: string, sellIntentId: string): string {
  return `potential::${demandId}::${sellIntentId}`;
}

export function parsePotentialMatchId(matchId: string): MatchPairKey | null {
  if (!matchId.startsWith("potential::")) return null;
  const rest = matchId.slice("potential::".length);
  const sep = rest.indexOf("::");
  if (sep <= 0) return null;
  return {
    demandId: rest.slice(0, sep),
    sellIntentId: rest.slice(sep + 2),
  };
}

export interface MatchCandidate {
  demandId: string;
  sellIntentId: string;
  productId: string;
  buyerId: string;
  sellerId: string;
}

export interface CandidateScanInput {
  demands: Demand[];
  sellIntents: SellIntent[];
  ownershipById: Map<
    string,
    { condition: ItemCondition; status: string; userId: string }
  >;
  nowMs: number;
}

/** Derived query: do not persist these as DB rows. */
export function listMatchCandidates(input: CandidateScanInput): MatchCandidate[] {
  const out: MatchCandidate[] = [];
  const openSells = input.sellIntents.filter((s) => s.status === "OPEN");

  for (const sell of openSells) {
    const ownership = input.ownershipById.get(sell.ownershipId);
    if (!ownership || ownership.status !== "OWNED") continue;

    for (const demand of input.demands) {
      if (
        !canCreateMatch({
          demand,
          sellIntent: sell,
          ownershipCondition: ownership.condition,
          nowMs: input.nowMs,
        })
      ) {
        continue;
      }
      out.push({
        demandId: demand.id,
        sellIntentId: sell.id,
        productId: demand.productId,
        buyerId: demand.userId,
        sellerId: sell.userId,
      });
    }
  }
  return out;
}

/** Buyer may move POTENTIAL → BUYER_INTERESTED only. */
export function canExpressBuyerInterest(
  match: Pick<Match, "status" | "buyerId">,
  actorId: string,
): boolean {
  if (match.buyerId !== actorId) return false;
  return match.status === "POTENTIAL";
}

/**
 * Seller connect only after buyer interest.
 * POTENTIAL → CONNECTED is rejected.
 */
export function canSellerConnect(
  match: Pick<Match, "status" | "sellerId">,
  actorId: string,
): boolean {
  if (match.sellerId !== actorId) return false;
  return match.status === "BUYER_INTERESTED";
}

export function transitionBuyerInterest(match: Match, actorId: string): Match | null {
  if (!canExpressBuyerInterest(match, actorId)) return null;
  return { ...match, status: "BUYER_INTERESTED" };
}

export function transitionSellerConnect(match: Match, actorId: string): Match | null {
  if (!canSellerConnect(match, actorId)) return null;
  return { ...match, status: "CONNECTED" };
}

/** Persist only progressive matches (BUYER_INTERESTED+). */
export function isPersistedMatchStatus(status: Match["status"]): boolean {
  return status !== "POTENTIAL";
}

export function toPotentialMatchView(
  candidate: MatchCandidate,
  createdAt: string,
): Match {
  return {
    id: potentialMatchId(candidate.demandId, candidate.sellIntentId),
    demandId: candidate.demandId,
    sellIntentId: candidate.sellIntentId,
    productId: candidate.productId,
    buyerId: candidate.buyerId,
    sellerId: candidate.sellerId,
    status: "POTENTIAL",
    createdAt,
  };
}

export function mergeVisibleMatches(args: {
  persisted: Match[];
  candidates: MatchCandidate[];
  userId: string;
  nowIso: string;
}): Match[] {
  const persistedForUser = args.persisted.filter(
    (m) =>
      (m.buyerId === args.userId || m.sellerId === args.userId) &&
      isPersistedMatchStatus(m.status),
  );
  const taken = new Set(
    persistedForUser.map((m) => pairKey(m.demandId, m.sellIntentId)),
  );
  const derived = args.candidates
    .filter(
      (c) =>
        (c.buyerId === args.userId || c.sellerId === args.userId) &&
        !taken.has(pairKey(c.demandId, c.sellIntentId)),
    )
    .map((c) => toPotentialMatchView(c, args.nowIso));
  return [...derived, ...persistedForUser];
}

export function buildVisibleMatches(
  state: {
    demands: Demand[];
    sellIntents: SellIntent[];
    ownerships: Array<{
      id: string;
      condition: ItemCondition;
      status: string;
      userId: string;
    }>;
    matches: Match[];
  },
  userId: string | null,
  nowMs = Date.now(),
): Match[] {
  if (!userId) return [];
  const ownershipById = new Map(
    state.ownerships.map((o) => [
      o.id,
      { condition: o.condition, status: o.status, userId: o.userId },
    ]),
  );
  const candidates = listMatchCandidates({
    demands: state.demands,
    sellIntents: state.sellIntents,
    ownershipById,
    nowMs,
  });
  return mergeVisibleMatches({
    persisted: state.matches,
    candidates,
    userId,
    nowIso: new Date(nowMs).toISOString(),
  });
}
