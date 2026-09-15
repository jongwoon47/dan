import { useMemo, useReducer, useState, type ReactNode } from "react";

import { upsertActiveDemand } from "./demands";
import { buildFeedItems } from "./feed";
import {
  areFulfillmentOptionsValid,
  tradeMethodFromFulfillment,
} from "./fulfillment";
import { defaultExpiresAtIso, isDemandOpen } from "./demandLifecycle";
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
  SEED_RESPONSES,
  SEED_SELL_INTENTS,
  aggregateDemands,
} from "./mockData";
import { canRespondToDemand, upsertOpenResponse } from "./responses";
import { upsertOpenSellIntent } from "./sellIntents";
import {
  displayProductName,
  findProductByMatchKey,
  productMatchKey,
} from "./productName";
import type {
  BuyDemand,
  Demand,
  DemandCategory,
  Match,
  Ownership,
  Response,
  SellIntent,
} from "./types";
import { isBuyDemand } from "./types";
import { createId } from "../lib/format";
import {
  DanContext,
  type CreateDemandInput,
  type DanContextValue,
} from "./danContext";
import type { DanState } from "./storeTypes";

const STORAGE_KEY = "dan-v2-fulfillment-store";

type Action =
  | { type: "LOGIN"; userId: string }
  | { type: "LOGOUT" }
  | { type: "UPSERT_DEMAND"; demand: Demand; ensureUserId?: string }
  | { type: "REPLACE_DEMAND"; demand: Demand }
  | { type: "CLOSE_DEMAND"; demandId: string }
  | { type: "CREATE_OWNERSHIP"; ownership: Ownership; ensureUserId?: string }
  | { type: "UPSERT_SELL_INTENT"; sellIntent: SellIntent; ensureUserId?: string }
  | { type: "UPSERT_RESPONSE"; response: Response; ensureUserId?: string }
  | { type: "ACCEPT_RESPONSE"; responseId: string }
  | { type: "BUYER_INTEREST"; match: Match }
  | { type: "SELLER_CONNECT"; matchId: string }
  | { type: "HYDRATE"; state: DanState };

function defaultState(): DanState {
  return {
    currentUserId: CURRENT_USER_ID,
    demands: SEED_DEMANDS,
    ownerships: SEED_OWNERSHIPS,
    sellIntents: SEED_SELL_INTENTS,
    responses: SEED_RESPONSES,
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
      responses: parsed.responses ?? SEED_RESPONSES,
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

function resolveDemoActorId(currentUserId: string | null): {
  actorId: string;
  ensureUserId?: string;
} {
  if (currentUserId) return { actorId: currentUserId };
  return { actorId: CURRENT_USER_ID, ensureUserId: CURRENT_USER_ID };
}

function categoryForBuyProduct(productId: string): DemandCategory {
  return PRODUCTS.find((p) => p.id === productId)?.category ?? "other";
}

function buildDemandFromInput(
  actorId: string,
  payload: CreateDemandInput,
  existingBuy?: BuyDemand,
): Demand {
  const now = new Date().toISOString();
  const scheduleIso =
    payload.type === "BUY"
      ? null
      : payload.type === "BORROW"
        ? payload.endAt
        : payload.type === "TASK"
          ? payload.dueAt
          : payload.preferredAt;
  const expiresAt = defaultExpiresAtIso(payload.type, scheduleIso);
  if (payload.type === "BUY") {
    const product = PRODUCTS.find((p) => p.id === payload.productId);
    const fulfillmentOptions = payload.fulfillmentOptions;
    const demand: BuyDemand = {
      id: existingBuy?.id ?? createId("demand"),
      userId: actorId,
      type: "BUY",
      title: payload.title || product?.name || payload.productId,
      description: payload.description ?? payload.title,
      category: categoryForBuyProduct(payload.productId),
      budget: payload.maxPrice,
      fulfillmentOptions,
      status: "ACTIVE",
      createdAt: existingBuy?.createdAt ?? now,
      expiresAt,
      details: {
        productId: payload.productId,
        maxPrice: payload.maxPrice,
        conditionPreference: payload.conditionPreference,
        tradeMethod:
          payload.tradeMethod ?? tradeMethodFromFulfillment(fulfillmentOptions),
      },
    };
    return demand;
  }
  if (payload.type === "BORROW") {
    return {
      id: createId("demand"),
      userId: actorId,
      type: "BORROW",
      title: payload.title,
      description: payload.description ?? payload.title,
      category: "rental",
      budget: payload.budget,
      fulfillmentOptions: payload.fulfillmentOptions,
      status: "ACTIVE",
      createdAt: now,
      expiresAt,
      details: {
        itemName: payload.itemName,
        startAt: payload.startAt,
        endAt: payload.endAt,
      },
    };
  }
  if (payload.type === "TASK") {
    return {
      id: createId("demand"),
      userId: actorId,
      type: "TASK",
      title: payload.title,
      description: payload.description ?? payload.taskDescription,
      category: "errand",
      budget: payload.budget,
      fulfillmentOptions: payload.fulfillmentOptions,
      status: "ACTIVE",
      createdAt: now,
      expiresAt,
      details: {
        taskDescription: payload.taskDescription,
        dueAt: payload.dueAt,
      },
    };
  }
  return {
    id: createId("demand"),
    userId: actorId,
    type: "SERVICE",
    title: payload.title,
    description: payload.description ?? payload.serviceDescription,
    category: "service",
    budget: payload.budget,
    fulfillmentOptions: payload.fulfillmentOptions,
    status: "ACTIVE",
    createdAt: now,
    expiresAt,
    details: {
      serviceDescription: payload.serviceDescription,
      preferredAt: payload.preferredAt,
      estimatedDurationMinutes: payload.estimatedDurationMinutes,
    },
  };
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
      let demands: Demand[];
      if (isBuyDemand(action.demand)) {
        demands = upsertActiveDemand(base.demands, action.demand);
      } else {
        demands = [action.demand, ...base.demands];
      }
      const next = { ...base, demands };
      persist(next);
      return next;
    }
    case "REPLACE_DEMAND": {
      const demands = state.demands.map((d) =>
        d.id === action.demand.id ? action.demand : d,
      );
      const next = { ...state, demands };
      persist(next);
      return next;
    }
    case "CLOSE_DEMAND": {
      const demands = state.demands.map((d) =>
        d.id === action.demandId ? { ...d, status: "CLOSED" as const } : d,
      );
      const next = { ...state, demands };
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
    case "UPSERT_RESPONSE": {
      const base = withEnsuredUser(state, action.ensureUserId);
      const { list } = upsertOpenResponse(base.responses, action.response);
      const next = { ...base, responses: list };
      persist(next);
      return next;
    }
    case "ACCEPT_RESPONSE": {
      const actorId = state.currentUserId;
      if (!actorId) return state;
      const response = state.responses.find((r) => r.id === action.responseId);
      if (!response || response.status !== "OPEN") return state;
      const demand = state.demands.find((d) => d.id === response.demandId);
      if (!demand || demand.userId !== actorId) return state;
      if (!isDemandOpen(demand)) return state;
      if (
        state.matches.some(
          (m) => m.demandId === demand.id && m.status === "CONNECTED",
        )
      ) {
        return state;
      }
      const responses = state.responses.map((r) => {
        if (r.id === response.id) return { ...r, status: "ACCEPTED" as const };
        if (r.demandId === demand.id && r.status === "OPEN") {
          return { ...r, status: "DECLINED" as const };
        }
        return r;
      });
      const match: Match = {
        id: createId("match"),
        demandId: demand.id,
        responseId: response.id,
        buyerId: demand.userId,
        sellerId: response.userId,
        status: "CONNECTED",
        createdAt: new Date().toISOString(),
      };
      const demands = state.demands.map((d) =>
        d.id === demand.id ? { ...d, status: "MATCHED" as const } : d,
      );
      const next = {
        ...state,
        demands,
        responses,
        matches: [match, ...state.matches],
      };
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

export function DanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [extraProducts, setExtraProducts] = useState<
    import("./types").Product[]
  >([]);
  const products = useMemo(
    () => [...PRODUCTS, ...extraProducts],
    [extraProducts],
  );
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
    const myResponses = state.responses.filter(
      (r) => r.userId === state.currentUserId,
    );
    const myMatches = buildVisibleMatches(state, state.currentUserId);
    const demandFeed = buildFeedItems(products, state.demands);

    return {
      state,
      products,
      users: DEMO_USERS,
      currentUser,
      isLoggedIn: Boolean(state.currentUserId),
      login: (userId = CURRENT_USER_ID) => dispatch({ type: "LOGIN", userId }),
      logout: () => dispatch({ type: "LOGOUT" }),
      ensureProduct: async (name) => {
        const display = displayProductName(name);
        const key = productMatchKey(display);
        if (!key) return null;
        const found = findProductByMatchKey(products, display);
        if (found) return found;
        const product: import("./types").Product = {
          id: createId("prod"),
          name: display,
          brand: "",
          model: display,
          category: "other",
          imageHue: 180 + ((key.length * 17) % 160),
          createdAt: new Date().toISOString(),
        };
        setExtraProducts((prev) => [...prev, product]);
        return product;
      },
      createDemand: async (payload) => {
        if (!areFulfillmentOptionsValid(payload.fulfillmentOptions)) {
          return null;
        }
        const { actorId, ensureUserId } = resolveDemoActorId(state.currentUserId);
        const existingBuy =
          payload.type === "BUY"
            ? state.demands.find(
                (d): d is BuyDemand =>
                  isBuyDemand(d) &&
                  d.userId === actorId &&
                  d.details.productId === payload.productId &&
                  d.status === "ACTIVE",
              )
            : undefined;
        const demand = buildDemandFromInput(actorId, payload, existingBuy);
        if (demand.type === "BUY") {
          const product = products.find((p) => p.id === demand.details.productId);
          demand.category = product?.category ?? "other";
        }
        dispatch({ type: "UPSERT_DEMAND", demand, ensureUserId });
        return demand;
      },
      createOwnership: async (payload) => {
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
      createSellIntent: async (payload) => {
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
      createResponse: async (payload) => {
        const { actorId, ensureUserId } = resolveDemoActorId(state.currentUserId);
        const demand = state.demands.find((d) => d.id === payload.demandId);
        if (!demand) return null;
        if (!canRespondToDemand(demand, actorId, Date.now())) return null;
        const response: Response = {
          id: createId("resp"),
          demandId: demand.id,
          userId: actorId,
          message: payload.message,
          offeredPrice: payload.offeredPrice,
          availabilityText: payload.availabilityText,
          status: "OPEN",
          createdAt: new Date().toISOString(),
        };
        const { result } = upsertOpenResponse(state.responses, response);
        dispatch({ type: "UPSERT_RESPONSE", response: result, ensureUserId });
        return result;
      },
      withdrawResponse: async (responseId) => {
        const response = state.responses.find((r) => r.id === responseId);
        if (!response || response.userId !== state.currentUserId) return null;
        if (response.status !== "OPEN") return null;
        const next = { ...response, status: "WITHDRAWN" as const };
        dispatch({ type: "UPSERT_RESPONSE", response: next });
        return next;
      },
      declineResponse: async (responseId) => {
        const response = state.responses.find((r) => r.id === responseId);
        const demand = response
          ? state.demands.find((d) => d.id === response.demandId)
          : undefined;
        if (!response || !demand || demand.userId !== state.currentUserId) return null;
        if (response.status !== "OPEN") return null;
        const next = { ...response, status: "DECLINED" as const };
        dispatch({ type: "UPSERT_RESPONSE", response: next });
        return next;
      },
      updateDemand: async (payload) => {
        const demand = state.demands.find((d) => d.id === payload.demandId);
        if (!demand || demand.userId !== state.currentUserId) return null;
        if (!isDemandOpen(demand)) return null;
        let next: Demand = {
          ...demand,
          title: payload.title,
          description: payload.description,
          budget: payload.budget,
          fulfillmentOptions: payload.fulfillmentOptions,
        };
        if (next.type === "BUY") {
          next = {
            ...next,
            budget: payload.maxPrice ?? payload.budget,
            details: {
              ...next.details,
              maxPrice: payload.maxPrice ?? payload.budget,
              conditionPreference:
                (payload.conditionPreference as typeof next.details.conditionPreference) ??
                next.details.conditionPreference,
              tradeMethod:
                (payload.tradeMethod as typeof next.details.tradeMethod) ??
                next.details.tradeMethod,
            },
          };
        } else if (next.type === "BORROW") {
          next = {
            ...next,
            details: {
              ...next.details,
              itemName: payload.itemName ?? next.details.itemName,
              startAt: payload.startAt ?? next.details.startAt,
              endAt: payload.endAt ?? next.details.endAt,
            },
          };
        } else if (next.type === "TASK") {
          next = {
            ...next,
            details: {
              ...next.details,
              taskDescription:
                payload.taskDescription ?? next.details.taskDescription,
              dueAt: payload.dueAt ?? next.details.dueAt,
            },
          };
        } else {
          next = {
            ...next,
            details: {
              ...next.details,
              serviceDescription:
                payload.serviceDescription ?? next.details.serviceDescription,
              preferredAt: payload.preferredAt ?? next.details.preferredAt,
            },
          };
        }
        dispatch({ type: "REPLACE_DEMAND", demand: next });
        return next;
      },
      closeDemand: async (demandId) => {
        const demand = state.demands.find((d) => d.id === demandId);
        if (!demand || demand.userId !== state.currentUserId) return null;
        dispatch({ type: "CLOSE_DEMAND", demandId });
        return { ...demand, status: "CLOSED" as const };
      },
      acceptResponse: async (responseId) => {
        const before = state.matches.length;
        dispatch({ type: "ACCEPT_RESPONSE", responseId });
        const response = state.responses.find((r) => r.id === responseId);
        const demand = response
          ? state.demands.find((d) => d.id === response.demandId)
          : undefined;
        if (!response || !demand || demand.userId !== state.currentUserId) {
          return null;
        }
        return {
          id: `pending-${before}`,
          demandId: demand.id,
          responseId,
          buyerId: demand.userId,
          sellerId: response.userId,
          status: "CONNECTED" as const,
          createdAt: new Date().toISOString(),
        };
      },
      listMessages: async () => [],
      sendMessage: async () => null,
      markMessagesRead: async () => undefined,
      activities: [],
      unreadActivityCount: 0,
      refreshActivities: async () => undefined,
      markActivityRead: async () => undefined,
      getPublicProfile: async (userId) => {
        const u = DEMO_USERS.find((x) => x.id === userId);
        if (!u) return null;
        return {
          id: u.id,
          displayName: u.name,
          defaultArea: u.defaultArea,
          bio: u.bio ?? "",
          createdAt: u.createdAt ?? new Date().toISOString(),
          connectionCount: 0,
        };
      },
      updateMyProfile: async () => currentUser,
      blockUser: async () => false,
      reportUser: async () => false,
      busy: false,
      loadError: null,
      expressBuyerInterest: async (matchId) => {
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
      connectAsSeller: async (matchId) => {
        dispatch({ type: "SELLER_CONNECT", matchId });
        return true;
      },
      getProduct: (id) => products.find((p) => p.id === id),
      getDemand: (id) => state.demands.find((d) => d.id === id),
      getAggregate: (productId) => aggregateDemands(productId, state.demands),
      demandFeed,
      myDemands,
      myOwnerships,
      mySellIntents,
      myResponses,
      myMatches,
      resetDemo: () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("dan-v0-store");
        localStorage.removeItem("dan-v0-store-v2");
        const fresh = defaultState();
        persist(fresh);
        dispatch({ type: "HYDRATE", state: fresh });
        setExtraProducts([]);
      },
    };
  }, [state, currentUser, products]);

  return <DanContext.Provider value={value}>{children}</DanContext.Provider>;
}
