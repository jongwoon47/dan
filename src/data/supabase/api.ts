import type { CreateDemandInput } from "@/domain/danContext";
import {
  formatFulfillmentSummary,
  tradeMethodFromFulfillment,
} from "@/domain/fulfillment";
import type {
  Demand,
  DemandAggregate,
  Match,
  Ownership,
  Product,
  Response,
  SellIntent,
  User,
} from "@/domain/types";
import { getSupabase } from "./client";
import {
  mapDemand,
  mapMatch,
  mapOwnership,
  mapProduct,
  mapResponse,
  mapSellIntent,
  type DbDemand,
  type DbMatch,
  type DbOwnership,
  type DbProduct,
  type DbResponse,
  type DbSellIntent,
} from "./mappers";

export async function fetchSessionUser(): Promise<User | null> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("id, display_name, location")
    .eq("id", auth.user.id)
    .maybeSingle();
  return {
    id: auth.user.id,
    name: profile?.display_name ?? auth.user.email ?? "DAN user",
    defaultArea: profile?.location ?? "",
  };
}

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await getSupabase().from("products").select("*").order("canonical_name");
  if (error) throw error;
  return ((data ?? []) as DbProduct[]).map(mapProduct);
}

export async function listActiveDemands(): Promise<Demand[]> {
  const { data, error } = await getSupabase()
    .from("demands")
    .select("*")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as DbDemand[])
    .map(mapDemand)
    .filter((d) => new Date(d.expiresAt).getTime() > now);
}

export async function listMyDemands(userId: string): Promise<Demand[]> {
  const { data, error } = await getSupabase()
    .from("demands")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbDemand[]).map(mapDemand);
}

export async function listOwnerships(userId: string): Promise<Ownership[]> {
  const { data, error } = await getSupabase()
    .from("ownerships")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "OWNED");
  if (error) throw error;
  return ((data ?? []) as DbOwnership[]).map(mapOwnership);
}

export async function listOwnershipsByIds(ids: string[]): Promise<Ownership[]> {
  if (ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from("ownerships")
    .select("*")
    .in("id", ids);
  if (error) throw error;
  return ((data ?? []) as DbOwnership[]).map(mapOwnership);
}

/** Responses where the user is responder OR owns the demand. */
export async function listPartyResponses(userId: string): Promise<Response[]> {
  const sb = getSupabase();
  const { data: mine, error: mineErr } = await sb
    .from("responses")
    .select("*")
    .eq("responder_id", userId);
  if (mineErr) throw mineErr;

  const { data: ownedDemands, error: demErr } = await sb
    .from("demands")
    .select("id")
    .eq("user_id", userId);
  if (demErr) throw demErr;
  const demandIds = (ownedDemands ?? []).map((d: { id: string }) => d.id);
  let incoming: DbResponse[] = [];
  if (demandIds.length > 0) {
    const { data, error } = await sb.from("responses").select("*").in("demand_id", demandIds);
    if (error) throw error;
    incoming = (data ?? []) as DbResponse[];
  }

  const map = new Map<string, Response>();
  for (const row of [...((mine ?? []) as DbResponse[]), ...incoming]) {
    map.set(row.id, mapResponse(row));
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listOpenSellIntents(): Promise<SellIntent[]> {
  const { data, error } = await getSupabase()
    .from("sell_intents")
    .select("*")
    .eq("status", "OPEN");
  if (error) throw error;
  return ((data ?? []) as DbSellIntent[]).map(mapSellIntent);
}

export async function listMySellIntents(userId: string): Promise<SellIntent[]> {
  const { data, error } = await getSupabase()
    .from("sell_intents")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as DbSellIntent[]).map(mapSellIntent);
}

export async function listMyResponses(userId: string): Promise<Response[]> {
  const { data, error } = await getSupabase()
    .from("responses")
    .select("*")
    .eq("responder_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbResponse[]).map(mapResponse);
}

export async function listResponsesForDemand(demandId: string): Promise<Response[]> {
  const { data, error } = await getSupabase()
    .from("responses")
    .select("*")
    .eq("demand_id", demandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbResponse[]).map(mapResponse);
}

export async function listMyMatches(userId: string): Promise<Match[]> {
  const { data, error } = await getSupabase()
    .from("matches")
    .select("*")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbMatch[]).map(mapMatch);
}

export async function listBuyAggregates(): Promise<
  Array<DemandAggregate & { productId: string }>
> {
  const { data, error } = await getSupabase().from("buy_demand_aggregates").select("*");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    productId: String(row.product_id),
    seekerCount: Number(row.seeker_count),
    minPrice: Number(row.min_price),
    maxPrice: Number(row.max_price),
    avgPrice: Number(row.avg_price),
    recent7dDelta: Number(row.recent_7d_delta),
    highestIntentPrice: Number(row.highest_intent_price),
    priceBuckets: [],
  }));
}

export async function createDemandRemote(input: CreateDemandInput): Promise<Demand> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("login required");

  if (input.type === "BUY") {
    const locationSummary = formatFulfillmentSummary(input.fulfillmentOptions);
    const tradeMethod =
      input.tradeMethod ?? tradeMethodFromFulfillment(input.fulfillmentOptions);
    const { data, error } = await sb.rpc("upsert_buy_demand", {
      p_product_id: input.productId,
      p_title: input.title,
      p_description: input.description ?? input.title,
      p_category: "electronics",
      p_max_price: input.maxPrice,
      p_location: locationSummary,
      p_condition_preference: input.conditionPreference,
      p_trade_method: tradeMethod,
      p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    if (error) throw error;
    return mapDemand(data as DbDemand);
  }

  const locationSummary = formatFulfillmentSummary(input.fulfillmentOptions);
  const row =
    input.type === "BORROW"
      ? {
          user_id: auth.user.id,
          type: "BORROW",
          title: input.title,
          description: input.description ?? input.title,
          category: "rental",
          budget: input.budget,
          location: locationSummary,
          status: "ACTIVE",
          item_name: input.itemName,
          start_at: input.startAt ?? null,
          end_at: input.endAt ?? null,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        }
      : input.type === "TASK"
        ? {
            user_id: auth.user.id,
            type: "TASK",
            title: input.title,
            description: input.description ?? input.taskDescription,
            category: "errand",
            budget: input.budget,
            location: locationSummary,
            status: "ACTIVE",
            task_description: input.taskDescription,
            due_at: input.dueAt ?? null,
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          }
        : {
            user_id: auth.user.id,
            type: "SERVICE",
            title: input.title,
            description: input.description ?? input.serviceDescription,
            category: "service",
            budget: input.budget,
            location: locationSummary,
            status: "ACTIVE",
            service_description: input.serviceDescription,
            preferred_at: input.preferredAt ?? null,
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          };

  const { data, error } = await sb
    .from("demands")
    .insert(row as Record<string, unknown>)
    .select("*")
    .single();
  if (error) throw error;
  return mapDemand(data as DbDemand);
}

export async function createOwnershipRemote(input: {
  productId: string;
  condition: Ownership["condition"];
}): Promise<Ownership> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("login required");

  const existing = await sb
    .from("ownerships")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("product_id", input.productId)
    .eq("status", "OWNED")
    .maybeSingle();
  if (existing.data) return mapOwnership(existing.data as DbOwnership);

  const { data, error } = await sb
    .from("ownerships")
    .insert({
      user_id: auth.user.id,
      product_id: input.productId,
      condition: input.condition,
      status: "OWNED",
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapOwnership(data as DbOwnership);
}

export async function upsertSellIntentRemote(input: {
  ownershipId: string;
  minimumPrice: number;
}): Promise<SellIntent> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("login required");

  const { data: ownership, error: ownErr } = await sb
    .from("ownerships")
    .select("*")
    .eq("id", input.ownershipId)
    .single();
  if (ownErr) throw ownErr;
  if (ownership.user_id !== auth.user.id) throw new Error("forbidden");

  const { data: open } = await sb
    .from("sell_intents")
    .select("*")
    .eq("ownership_id", input.ownershipId)
    .eq("status", "OPEN")
    .maybeSingle();

  if (open) {
    const { data, error } = await sb
      .from("sell_intents")
      .update({ minimum_price: input.minimumPrice })
      .eq("id", open.id)
      .select("*")
      .single();
    if (error) throw error;
    return mapSellIntent(data as DbSellIntent);
  }

  const { data, error } = await sb
    .from("sell_intents")
    .insert({
      ownership_id: input.ownershipId,
      user_id: auth.user.id,
      product_id: ownership.product_id,
      minimum_price: input.minimumPrice,
      status: "OPEN",
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapSellIntent(data as DbSellIntent);
}

export async function createResponseRemote(input: {
  demandId: string;
  message: string;
  offeredPrice?: number;
}): Promise<Response> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error("login required");

  const { data, error } = await sb
    .from("responses")
    .insert({
      demand_id: input.demandId,
      responder_id: auth.user.id,
      response_type: "FULFILL",
      message: input.message,
      offered_price: input.offeredPrice ?? null,
      status: "OPEN",
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapResponse(data as DbResponse);
}

export async function acceptResponseRemote(responseId: string): Promise<Match> {
  const { data, error } = await getSupabase().rpc("accept_response", {
    p_response_id: responseId,
  });
  if (error) throw error;
  return mapMatch(data as DbMatch);
}

export async function expressBuyerInterestRemote(
  demandId: string,
  sellIntentId: string,
): Promise<Match> {
  const { data, error } = await getSupabase().rpc("express_buyer_interest", {
    p_demand_id: demandId,
    p_sell_intent_id: sellIntentId,
  });
  if (error) throw error;
  return mapMatch(data as DbMatch);
}

export async function sellerConnectRemote(matchId: string): Promise<Match> {
  const { data, error } = await getSupabase().rpc("seller_connect_match", {
    p_match_id: matchId,
  });
  if (error) throw error;
  return mapMatch(data as DbMatch);
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}
