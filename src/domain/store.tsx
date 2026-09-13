import { useMemo, useReducer, type ReactNode } from "react";

import { canCreateMatch } from "./matching";
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
import type {
  Demand,
  Match,
  Ownership,
  SellIntent,
} from "./types";
import { createId } from "../lib/format";
import { DanContext, type DanContextValue } from "./danContext";
import type { DanState } from "./storeTypes";

const STORAGE_KEY = "dan-v0-store";

type Action =
  | { type: "LOGIN"; userId: string }
  | { type: "LOGOUT" }
  | { type: "CREATE_DEMAND"; demand: Demand }
  | { type: "CREATE_OWNERSHIP"; ownership: Ownership }
  | { type: "CREATE_SELL_INTENT"; sellIntent: SellIntent }
  | { type: "BUYER_INTEREST"; matchId: string }
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
      matches: parsed.matches ?? SEED_MATCHES,
    };
  } catch {
    return defaultState();
  }
}

function persist(state: DanState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function recomputeMatches(state: DanState): Match[] {
  const existingKeys = new Set(
    state.matches.map((m) => `${m.demandId}:${m.sellIntentId}`),
  );
  const next = [...state.matches];

  for (const sell of state.sellIntents.filter((s) => s.status === "OPEN")) {
    const ownership = state.ownerships.find((o) => o.id === sell.ownershipId);
    if (!ownership || ownership.status !== "OWNED") continue;

    for (const demand of state.demands.filter((d) => d.status === "ACTIVE")) {
      const key = `${demand.id}:${sell.id}`;
      if (existingKeys.has(key)) continue;
      if (
        !canCreateMatch({
          demand,
          sellIntent: sell,
          ownershipCondition: ownership.condition,
        })
      ) {
        continue;
      }
      next.push({
        id: createId("match"),
        demandId: demand.id,
        sellIntentId: sell.id,
        productId: demand.productId,
        buyerId: demand.userId,
        sellerId: sell.userId,
        status: "POTENTIAL",
        createdAt: new Date().toISOString(),
      });
      existingKeys.add(key);
    }
  }
  return next;
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
    case "CREATE_DEMAND": {
      const base = { ...state, demands: [action.demand, ...state.demands] };
      const next = { ...base, matches: recomputeMatches(base) };
      persist(next);
      return next;
    }
    case "CREATE_OWNERSHIP": {
      const next = {
        ...state,
        ownerships: [action.ownership, ...state.ownerships],
      };
      persist(next);
      return next;
    }
    case "CREATE_SELL_INTENT": {
      const base = {
        ...state,
        sellIntents: [action.sellIntent, ...state.sellIntents],
      };
      const next = { ...base, matches: recomputeMatches(base) };
      persist(next);
      return next;
    }
    case "BUYER_INTEREST": {
      const matches = state.matches.map((m) =>
        m.id === action.matchId && m.buyerId === state.currentUserId
          ? { ...m, status: "BUYER_INTERESTED" as const }
          : m,
      );
      const next = { ...state, matches };
      persist(next);
      return next;
    }
    case "SELLER_CONNECT": {
      const matches = state.matches.map((m) =>
        m.id === action.matchId && m.sellerId === state.currentUserId
          ? { ...m, status: "CONNECTED" as const }
          : m,
      );
      const next = { ...state, matches };
      persist(next);
      return next;
    }
    default:
      return state;
  }
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
    const myMatches = state.matches.filter(
      (m) =>
        m.buyerId === state.currentUserId || m.sellerId === state.currentUserId,
    );

    return {
      state,
      products: PRODUCTS,
      users: DEMO_USERS,
      currentUser,
      isLoggedIn: Boolean(state.currentUserId),
      login: (userId = CURRENT_USER_ID) => dispatch({ type: "LOGIN", userId }),
      logout: () => dispatch({ type: "LOGOUT" }),
      createDemand: (payload) => {
        if (!state.currentUserId) return null;
        const demand: Demand = {
          id: createId("demand"),
          userId: state.currentUserId,
          productId: payload.productId,
          maxPrice: payload.maxPrice,
          conditionPreference: payload.conditionPreference,
          location: payload.location,
          tradeMethod: payload.tradeMethod,
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        };
        dispatch({ type: "CREATE_DEMAND", demand });
        return demand;
      },
      createOwnership: (payload) => {
        if (!state.currentUserId) return null;
        const existing = state.ownerships.find(
          (o) =>
            o.userId === state.currentUserId &&
            o.productId === payload.productId &&
            o.status === "OWNED",
        );
        if (existing) return existing;
        const ownership: Ownership = {
          id: createId("own"),
          userId: state.currentUserId,
          productId: payload.productId,
          condition: payload.condition,
          status: "OWNED",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "CREATE_OWNERSHIP", ownership });
        return ownership;
      },
      createSellIntent: (payload) => {
        if (!state.currentUserId) return null;
        const ownership = state.ownerships.find(
          (o) => o.id === payload.ownershipId,
        );
        if (!ownership || ownership.userId !== state.currentUserId) return null;
        const sellIntent: SellIntent = {
          id: createId("sell"),
          ownershipId: ownership.id,
          userId: state.currentUserId,
          productId: ownership.productId,
          minimumPrice: payload.minimumPrice,
          status: "OPEN",
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "CREATE_SELL_INTENT", sellIntent });
        return sellIntent;
      },
      expressBuyerInterest: (matchId) =>
        dispatch({ type: "BUYER_INTEREST", matchId }),
      connectAsSeller: (matchId) =>
        dispatch({ type: "SELLER_CONNECT", matchId }),
      getProduct: (id) => PRODUCTS.find((p) => p.id === id),
      getAggregate: (productId) => aggregateDemands(productId, state.demands),
      demandFeed: listDemandAggregates(PRODUCTS, state.demands),
      myDemands,
      myOwnerships,
      mySellIntents,
      myMatches,
      resetDemo: () => {
        localStorage.removeItem(STORAGE_KEY);
        const fresh = defaultState();
        persist(fresh);
        dispatch({ type: "HYDRATE", state: fresh });
      },
    };
  }, [state, currentUser]);

  return <DanContext.Provider value={value}>{children}</DanContext.Provider>;
}
