import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import * as api from "@/data/supabase/api";
import { ko } from "@/copy/ko";
import { buildFeedItems } from "@/domain/feed";
import { mergeBuyAggregate } from "@/domain/mergeAggregate";
import { buildVisibleMatches, parsePotentialMatchId } from "@/domain/matchLifecycle";
import {
  DanContext,
  type CreateDemandInput,
  type DanContextValue,
} from "@/domain/danContext";
import type { DanState } from "@/domain/storeTypes";
import type {
  Demand,
  DemandAggregate,
  Match,
  Ownership,
  Product,
  Response,
  SellIntent,
} from "@/domain/types";
import { assignLogin } from "@/lib/loginNext";
import { extendBuyExpiresAt } from "@/domain/demandLifecycle";

type LoadState = "idle" | "loading" | "ready" | "error";

export function SupabaseDanProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [ownerships, setOwnerships] = useState<Ownership[]>([]);
  const [sellIntents, setSellIntents] = useState<SellIntent[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [aggregates, setAggregates] = useState<
    Array<DemandAggregate & { productId: string }>
  >([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activities, setActivities] = useState<
    import("@/domain/types").ActivityEvent[]
  >([]);

  const refresh = useCallback(async () => {
    setLoadState((prev) => (prev === "ready" ? "ready" : "loading"));
    setError(null);
    try {
      const [productRows, demandRows, aggRows] = await Promise.all([
        api.listProducts(),
        api.listActiveDemands(),
        api.listBuyAggregates(),
      ]);
      setProducts(productRows);
      setDemands(demandRows);
      setAggregates(aggRows);

      if (auth.user) {
        const [sellRows, owns, mySells, partyResponses, myMatches, myDemands] =
          await Promise.all([
            api.listOpenSellIntents(),
            api.listOwnerships(auth.user.id),
            api.listMySellIntents(auth.user.id),
            api.listPartyResponses(auth.user.id),
            api.listMyMatches(auth.user.id),
            api.listMyDemands(auth.user.id),
          ]);

        const ownershipIds = [
          ...new Set([
            ...sellRows.map((s) => s.ownershipId),
            ...mySells.map((s) => s.ownershipId),
            ...owns.map((o) => o.id),
          ]),
        ];
        const openOwns = await api.listOwnershipsByIds(ownershipIds);
        const ownMap = new Map<string, Ownership>();
        for (const o of [...owns, ...openOwns]) ownMap.set(o.id, o);

        setOwnerships([...ownMap.values()]);
        setSellIntents(() => {
          const map = new Map(sellRows.map((s) => [s.id, s]));
          for (const s of mySells) map.set(s.id, s);
          return [...map.values()];
        });
        setResponses(partyResponses);
        setMatches(myMatches);
        setDemands((prev) => {
          const map = new Map(prev.map((d) => [d.id, d]));
          for (const d of myDemands) map.set(d.id, d);
          return [...map.values()];
        });
      } else {
        setOwnerships([]);
        setSellIntents([]);
        setResponses([]);
        setMatches([]);
      }
      setLoadState("ready");
      if (auth.user) {
        try {
          const acts = await api.listActivityRemote();
          setActivities(acts);
        } catch {
          /* activity is best-effort */
        }
      } else {
        setActivities([]);
      }
    } catch (e) {
      setError(ko.loadFailed);
      setLoadState("error");
    }
  }, [auth.user]);

  useEffect(() => {
    if (auth.status === "loading") return;
    void refresh();
  }, [auth.status, auth.user?.id, refresh]);

  const state: DanState = useMemo(
    () => ({
      currentUserId: auth.user?.id ?? null,
      demands,
      ownerships,
      sellIntents,
      responses,
      matches,
    }),
    [auth.user?.id, demands, ownerships, sellIntents, responses, matches],
  );

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (busy) return null;
      setBusy(true);
      setError(null);
      try {
        const result = await fn();
        await refresh();
        return result;
      } catch {
        // Leave error ownership to the calling screen (inline/form).
        // Avoid stacking a global banner on the same mutation failure.
        return null;
      } finally {
        setBusy(false);
      }
    },
    [busy, refresh],
  );

  const value = useMemo<DanContextValue>(() => {
    const currentUser = auth.user;
    const myDemands = demands.filter((d) => d.userId === currentUser?.id);
    const myOwnerships = ownerships.filter(
      (o) => o.userId === currentUser?.id && o.status === "OWNED",
    );
    const mySellIntents = sellIntents.filter((s) => s.userId === currentUser?.id);
    const myResponses = responses.filter((r) => r.userId === currentUser?.id);
    const myMatches = buildVisibleMatches(state, currentUser?.id ?? null);
    const demandFeed = buildFeedItems(products, demands);

    return {
      state,
      products,
      users: currentUser ? [currentUser] : [],
      currentUser,
      isLoggedIn: Boolean(currentUser),
      login: () => {
        assignLogin();
      },
      logout: () => {
        void auth.signOut();
      },
      createDemand: async (payload: CreateDemandInput) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.createDemandRemote(payload));
      },
      ensureProduct: async (name) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.ensureProductRemote(name));
      },
      createOwnership: async (payload) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.createOwnershipRemote(payload));
      },
      createSellIntent: async (payload) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.upsertSellIntentRemote(payload));
      },
      createResponse: async (payload) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.createResponseRemote(payload));
      },
      withdrawResponse: async (responseId) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.withdrawResponseRemote(responseId));
      },
      declineResponse: async (responseId) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.declineResponseRemote(responseId));
      },
      updateDemand: async (payload) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.updateDemandRemote(payload));
      },
      closeDemand: async (demandId) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.closeDemandRemote(demandId));
      },
      extendBuyDemand: async (demandId) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        const demand = demands.find((d) => d.id === demandId);
        if (!demand || demand.type !== "BUY") return null;
        if (demand.status === "MATCHED" || demand.status === "CLOSED") return null;
        return run(() =>
          api.updateDemandRemote({
            demandId: demand.id,
            title: demand.title,
            description: demand.description,
            budget: demand.budget,
            fulfillmentOptions: demand.fulfillmentOptions,
            expiresAt: extendBuyExpiresAt(),
            maxPrice: demand.details.maxPrice,
            conditionPreference: demand.details.conditionPreference,
            tradeMethod: demand.details.tradeMethod,
          }),
        );
      },
      acceptResponse: async (responseId) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.acceptResponseRemote(responseId));
      },
      listMessages: async (matchId) => {
        if (!currentUser) return [];
        try {
          return await api.listMessagesRemote(matchId);
        } catch (e) {
          setError(ko.genericError);
          return [];
        }
      },
      sendMessage: async (matchId, body) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.sendMessageRemote(matchId, body));
      },
      markMessagesRead: async (matchId) => {
        if (!currentUser) return;
        try {
          await api.markMessagesReadRemote(matchId);
        } catch {
          /* ignore */
        }
      },
      activities,
      unreadActivityCount: activities.filter((a) => !a.readAt).length,
      refreshActivities: async () => {
        if (!currentUser) {
          setActivities([]);
          return;
        }
        try {
          setActivities(await api.listActivityRemote());
        } catch {
          /* ignore */
        }
      },
      markActivityRead: async (activityId) => {
        if (!currentUser) return;
        try {
          await api.markActivityReadRemote(activityId);
          setActivities(await api.listActivityRemote());
        } catch {
          /* ignore */
        }
      },
      getPublicProfile: async (userId) => {
        try {
          return await api.fetchPublicProfile(userId);
        } catch {
          return null;
        }
      },
      updateMyProfile: async (payload) => {
        if (!currentUser) {
          assignLogin();
          return null;
        }
        return run(() => api.updateMyProfileRemote(payload));
      },
      blockUser: async (userId) => {
        if (!currentUser) {
          assignLogin();
          return false;
        }
        const ok = await run(() => api.blockUserRemote(userId));
        return ok !== null;
      },
      reportUser: async (payload) => {
        if (!currentUser) {
          assignLogin();
          return false;
        }
        const ok = await run(() => api.reportUserRemote(payload));
        return ok !== null;
      },
      busy,
      loadError: error,
      expressBuyerInterest: async (matchId) => {
        if (!currentUser) {
          assignLogin();
          return false;
        }
        const visible = buildVisibleMatches(state, currentUser.id);
        const match = visible.find((m) => m.id === matchId);
        let demandId = match?.demandId;
        let sellIntentId = match?.sellIntentId;
        if (!demandId || !sellIntentId) {
          const parsed = parsePotentialMatchId(matchId);
          if (!parsed) return false;
          demandId = parsed.demandId;
          sellIntentId = parsed.sellIntentId;
        }
        const result = await run(() =>
          api.expressBuyerInterestRemote(demandId!, sellIntentId!),
        );
        return Boolean(result);
      },
      connectAsSeller: async (matchId) => {
        if (!currentUser) {
          assignLogin();
          return false;
        }
        const result = await run(() => api.sellerConnectRemote(matchId));
        return Boolean(result);
      },
      getProduct: (id) => products.find((p) => p.id === id),
      getDemand: (id) => demands.find((d) => d.id === id),
      getAggregate: (productId) => {
        const remote = aggregates.find((a) => a.productId === productId);
        return mergeBuyAggregate(productId, demands, remote);
      },
      demandFeed,
      myDemands,
      myOwnerships,
      mySellIntents,
      myResponses,
      myMatches,
      resetDemo: () => {
        void refresh();
      },
    };
  }, [
    auth,
    state,
    products,
    demands,
    ownerships,
    sellIntents,
    responses,
    aggregates,
    activities,
    error,
    busy,
    run,
    refresh,
  ]);

  if (auth.status === "loading" || loadState === "loading") {
    return (
      <div className="app-main">
        <div className="skeleton-block" aria-busy="true">
          <div className="skeleton-line skeleton-line--lg" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--sm" />
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="app-main page-stack">
        <p role="alert">{ko.loadFailed}</p>
        <button type="button" className="text-link" onClick={() => void refresh()}>
          {ko.retry}
        </button>
      </div>
    );
  }

  return (
    <DanContext.Provider value={value}>
      {error ? (
        <div className="mutation-error" role="alert">
          {ko.genericError}
          <button type="button" className="text-link" onClick={() => setError(null)}>
            {ko.dismiss}
          </button>
        </div>
      ) : null}
      {children}
    </DanContext.Provider>
  );
}
