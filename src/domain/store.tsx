import { useMemo, useReducer, type ReactNode } from "react";

import { upsertActiveDemand } from "./demands";
import {
  buildVisibleMatches,
  listMatchCandidates,
  parsePotentialMatchId,
  toPotentialMatchView,
  transitionBuyerInterest,
  transitionSellerConnect,
} from "./matchLifecycle";
import {
  CURRENT_USER_ID,
  DEMO_USERS,
  PRODUCTS,
  SEED_DEMANDS,
  SEED_MATCHES,
  SEED_OWNERSHIPS,
  SEED_SELL_INTENTS,
  aggregateDemands,
  listDemandAggregates,
} from "./mockData";
import { upsertOpenSellIntent } from "./sellIntents";
import type { Demand, Match, Ownership, SellIntent } from "./types";
import { createId } from "../lib/format";
import { DanContext, type DanContextValue } from "./danContext";
import type { DanState } from "./storeTypes";

const STORAGE_KEY = "dan-v0-store-v2";

type Action =
  | { type: "LOGIN"; userId: string }
  | { type: "LOGOUT" }
  | { type: "UPSERT_DEMAND"; demand: Demand; ensureUserId?: string }
  | { type: "CREATE_OWNERSHIP"; ownership: Ownership; ensureUserId?: string }
  | { type: "UPSERT_SELL_INTENT"; sellIntent: SellIntent; ensureUserId?: string }
  | { type: "BUYER_INTEREST"; match: Match }
  | { type: "SELLER_CONNECT"; matchId: string }
  | { type: "HYDRATE"; state: DanState };

function defaultState(): DanState {
  return {
    currentUserId: CURRENT_USER_ID,
    demands: SEED_DEMANDS,
    ownerships: SEED_OWNERSHIPS,
    sellIntents: SEED_SELL_INTENTS,
    matches: SEED_MATCHES,
  };
}

function sanitizePersistedMatches(matches: Match[] | undefined): Match[] {
  return (matches ?? SEED_MATCHES).filter((m) => m.status !== "POTENTIAL");
}

function loadState(): DanState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<DanState>;
    return {
      ...defaultState(),
      ...parsed,
      demands: parsed.demands?.length ? parsed.demands : SEED_DEMANDS,
      ownerships: parsed.ownerships ?? SEED_OWNERSHIPS,
      sellIntents: parsed.sellIntents ?? SEED_SELL_INTENTS,
      matches: sanitizePersistedMatches(parsed.matches),
    };
  } catch {
    return defaultState();
  }
}

function persist(state: DanState) {
  const toSave: DanState = {
    ...state,
    matches: sanitizePersistedMatches(state.matches),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function withEnsuredUser(state: DanState, ensureUserId?: string): DanState {
  if (!ensureUserId || state.currentUserId) return state;
  return { ...state, currentUserId: ensureUserId };
}

function ownershipMap(state: DanState) {
  return new Map(
    state.ownerships.map((o) => [
      o.id,
      { condition: o.condition, status: o.status, userId: o.userId },
    ]),
  );
}

function reducer(state: DanState, action: Action): DanState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "LOGIN": {
      const next = { ...state, currentUserId: action.userId };
      persist(next);
      return next;
    }
    case "LOGOUT": {
      const next = { ...state, currentUserId: null };
      persist(next);
      return next;
    }
    case "UPSERT_DEMAND": {
      const base = withEnsuredUser(state, action.ensureUserId);
      const next = {
        ...base,
        demands: upsertActiveDemand(base.demands, action.demand),
      };
      persist(next);
      return next;
    }
    case "CREATE_OWNERSHIP": {
      const base = withEnsuredUser(state, action.ensureUserId);
      const next = {
        ...base,
        ownerships: [action.ownership, ...base.ownerships],
      };
      persist(next);
      return next;
    }
    case "UPSERT_SELL_INTENT": {
      const base = withEnsuredUser(state, action.ensureUserId);
      const { list } = upsertOpenSellIntent(base.sellIntents, action.sellIntent);
      const next = { ...base, sellIntents: list };
      persist(next);
      return next;
    }
    case "BUYER_INTEREST": {
      const actorId = state.currentUserId;
      if (!actorId) return state;
      const existing = state.matches.find(
        (m) =>
          m.demandId === action.match.demandId &&
          m.sellIntentId === action.match.sellIntentId,
      );
      if (existing) {
        const transitioned = transitionBuyerInterest(existing, actorId);
        if (!transitioned) return state;
        const matches = state.matches.map((m) =>
          m.id === existing.id ? transitioned : m,
        );
        const next = { ...state, matches };
        persist(next);
        return next;
      }
      // Materialize derived POTENTIAL into persisted BUYER_INTERESTED.
      if (action.match.status !== "POTENTIAL") return state;
      if (action.match.buyerId !== actorId) return state;
      const materialized: Match = {
        ...action.match,
        id: createId("match"),
        status: "BUYER_INTERESTED",
      };
      const next = { ...state, matches: [materialized, ...state.matches] };
      persist(next);
      return next;
    }
    case "SELLER_CONNECT": {
      const actorId = state.currentUserId;
      if (!actorId) return state;
      const current = state.matches.find((m) => m.id === action.matchId);
      if (!current) return state;
      const transitioned = transitionSellerConnect(current, actorId);
      if (!transitioned) return state;
      const matches = state.matches.map((m) =>
        m.id === action.matchId ? transitioned : m,
      );
      const next = { ...state, matches };
      persist(next);
      return next;
    }
    default:
      return state;
  }
}

/** Resolve demo actor without assuming a prior login render flush. */
function resolveDemoActorId(currentUserId: string | null): {
  actorId: string;
  ensureUserId?: string;
} {
  if (currentUserId) return { actorId: currentUserId };
  return { actorId: CURRENT_USER_ID, ensureUserId: CURRENT_USER_ID };
}

export function DanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const currentUser =
    DEMO_USERS.find((u) => u.id === state.currentUserId) ?? null;

  const value = useMemo<DanContextValue>(() => {
    const myDemands = state.demands.filter(
      (d) => d.userId === state.currentUserId,
    );
    const myOwnerships = state.ownerships.filter(
      (o) => o.userId === state.currentUserId && o.status === "OWNED",
    );
    const mySellIntents = state.sellIntents.filter(
      (s) => s.userId === state.currentUserId,
    );
    const myMatches = buildVisibleMatches(state, state.currentUserId);

    return {
      state,
      products: PRODUCTS,
      users: DEMO_USERS,
      currentUser,
      isLoggedIn: Boolean(state.currentUserId),
      login: (userId = CURRENT_USER_ID) => dispatch({ type: "LOGIN", userId }),
      logout: () => dispatch({ type: "LOGOUT" }),
      createDemand: (payload) => {
        const { actorId, ensureUserId } = resolveDemoActorId(state.currentUserId);
        const existing = state.demands.find(
          (d) =>
            d.userId === actorId &&
            d.productId === payload.productId &&
            d.status === "ACTIVE",
        );
        const demand: Demand = {
          id: existing?.id ?? createId("demand"),
          userId: actorId,
          productId: payload.productId,
          maxPrice: payload.maxPrice,
          conditionPreference: payload.conditionPreference,
          location: payload.location,
          tradeMethod: payload.tradeMethod,
          status: "ACTIVE",
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        };
        dispatch({ type: "UPSERT_DEMAND", demand, ensureUserId });
        return demand;
      },
      createOwnership: (payload) => {
        const { actorId, ensureUserId } = resolveDemoActorId(state.currentUserId);
        const existing = state.ownerships.find(
          (o) =>
            o.userId === actorId &&
            o.productId === payload.productId &&
            o.status === "OWNED",
        );
        if (existing) {
          if (ensureUserId) dispatch({ type: "LOGIN", userId: ensureUserId });
          return existing;
        }
        const ownership: Ownership = {
          id: createId("own"),
          userId: actorId,
          productId: payload.productId,
          condition: payload.condition,
          status: "OWNED",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "CREATE_OWNERSHIP", ownership, ensureUserId });
        return ownership;
      },
      createSellIntent: (payload) => {
        const { actorId, ensureUserId } = resolveDemoActorId(state.currentUserId);
        const ownership = state.ownerships.find((o) => o.id === payload.ownershipId);
        if (!ownership || ownership.userId !== actorId) return null;
        const existingOpen = state.sellIntents.find(
          (s) => s.ownershipId === ownership.id && s.status === "OPEN",
        );
        const sellIntent: SellIntent = {
          id: existingOpen?.id ?? createId("sell"),
          ownershipId: ownership.id,
          userId: actorId,
          productId: ownership.productId,
          minimumPrice: payload.minimumPrice,
          status: "OPEN",
          createdAt: existingOpen?.createdAt ?? new Date().toISOString(),
        };
        const { result } = upsertOpenSellIntent(state.sellIntents, sellIntent);
        dispatch({ type: "UPSERT_SELL_INTENT", sellIntent: result, ensureUserId });
        return result;
      },
      expressBuyerInterest: (matchId) => {
        const visible = buildVisibleMatches(state, state.currentUserId);
        const match =
          visible.find((m) => m.id === matchId) ??
          state.matches.find((m) => m.id === matchId);
        if (!match) {
          const parsed = parsePotentialMatchId(matchId);
          if (!parsed) return false;
          const candidates = listMatchCandidates({
            demands: state.demands,
            sellIntents: state.sellIntents,
            ownershipById: ownershipMap(state),
            nowMs: Date.now(),
          });
          const candidate = candidates.find(
            (c) =>
              c.demandId === parsed.demandId &&
              c.sellIntentId === parsed.sellIntentId,
          );
          if (!candidate) return false;
          dispatch({
            type: "BUYER_INTEREST",
            match: toPotentialMatchView(candidate, new Date().toISOString()),
          });
          return true;
        }
        dispatch({ type: "BUYER_INTEREST", match });
        return true;
      },
      connectAsSeller: (matchId) => {
        dispatch({ type: "SELLER_CONNECT", matchId });
        return true;
      },
      getProduct: (id) => PRODUCTS.find((p) => p.id === id),
      getAggregate: (productId) => aggregateDemands(productId, state.demands),
      demandFeed: listDemandAggregates(PRODUCTS, state.demands),
      myDemands,
      myOwnerships,
      mySellIntents,
      myMatches,
      resetDemo: () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("dan-v0-store");
        const fresh = defaultState();
        persist(fresh);
        dispatch({ type: "HYDRATE", state: fresh });
      },
    };
  }, [state, currentUser]);

  return <DanContext.Provider value={value}>{children}</DanContext.Provider>;
}
