import type {
  BuyDemand,
  Demand,
  DemandCategory,
  DemandType,
  ItemCondition,
  Match,
  MatchStatus,
  Ownership,
  Product,
  ProductCategory,
  Response,
  SellIntent,
} from "@/domain/types";
import {
  fulfillmentFromLegacyLocation,
  type FulfillmentOption,
} from "@/domain/fulfillment";

export type DbProduct = {
  id: string;
  canonical_name: string;
  brand: string | null;
  model: string | null;
  category: string;
  image_hue: number;
  created_at: string;
};

export type DbDemand = {
  id: string;
  user_id: string;
  type: DemandType;
  title: string;
  description: string;
  category: string;
  budget: number;
  location: string;
  fulfillment_options?: unknown;
  status: Demand["status"];
  product_id: string | null;
  max_price: number | null;
  condition_preference: string | null;
  trade_method: string | null;
  item_name: string | null;
  start_at: string | null;
  end_at: string | null;
  task_description: string | null;
  service_description: string | null;
  preferred_at: string | null;
  due_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbOwnership = {
  id: string;
  user_id: string;
  product_id: string;
  condition: ItemCondition;
  status: Ownership["status"];
  created_at: string;
};

export type DbSellIntent = {
  id: string;
  ownership_id: string;
  user_id: string;
  product_id: string;
  minimum_price: number;
  status: SellIntent["status"];
  created_at: string;
  updated_at: string;
};

export type DbResponse = {
  id: string;
  demand_id: string;
  responder_id: string;
  response_type: string;
  message: string;
  offered_price: number | null;
  status: Response["status"];
  created_at: string;
  updated_at: string;
};

export type DbMatch = {
  id: string;
  demand_id: string;
  sell_intent_id: string | null;
  response_id: string | null;
  product_id: string | null;
  buyer_id: string;
  seller_id: string;
  status: Exclude<MatchStatus, "POTENTIAL">;
  created_at: string;
  updated_at: string;
};

export function mapProduct(row: DbProduct): Product {
  return {
    id: row.id,
    name: row.canonical_name,
    brand: row.brand ?? "",
    model: row.model ?? row.canonical_name,
    category: row.category as ProductCategory,
    imageHue: row.image_hue,
    createdAt: row.created_at,
  };
}

export function mapDemand(row: DbDemand): Demand {
  const fulfillmentOptions =
    Array.isArray(row.fulfillment_options) && row.fulfillment_options.length > 0
      ? (row.fulfillment_options as FulfillmentOption[])
      : fulfillmentFromLegacyLocation(row.location ?? "");

  const base = {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category as DemandCategory,
    budget: Number(row.budget),
    fulfillmentOptions,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? row.created_at,
  };

  if (row.type === "BUY") {
    const buy: BuyDemand = {
      ...base,
      type: "BUY",
      details: {
        productId: row.product_id!,
        maxPrice: Number(row.max_price ?? row.budget),
        conditionPreference: (row.condition_preference as BuyDemand["details"]["conditionPreference"]) ?? "any",
        tradeMethod: (row.trade_method as BuyDemand["details"]["tradeMethod"]) ?? "any",
      },
    };
    return buy;
  }
  if (row.type === "BORROW") {
    return {
      ...base,
      type: "BORROW",
      details: {
        itemName: row.item_name ?? row.title,
        startAt: row.start_at ?? undefined,
        endAt: row.end_at ?? undefined,
      },
    };
  }
  if (row.type === "TASK") {
    return {
      ...base,
      type: "TASK",
      details: {
        taskDescription: row.task_description ?? row.description,
        dueAt: row.due_at ?? undefined,
      },
    };
  }
  return {
    ...base,
    type: "SERVICE",
    details: {
      serviceDescription: row.service_description ?? row.description,
      preferredAt: row.preferred_at ?? undefined,
    },
  };
}

export function mapOwnership(row: DbOwnership): Ownership {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id,
    condition: row.condition,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapSellIntent(row: DbSellIntent): SellIntent {
  return {
    id: row.id,
    ownershipId: row.ownership_id,
    userId: row.user_id,
    productId: row.product_id,
    minimumPrice: Number(row.minimum_price),
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapResponse(row: DbResponse): Response {
  return {
    id: row.id,
    demandId: row.demand_id,
    userId: row.responder_id,
    message: row.message,
    offeredPrice: row.offered_price == null ? undefined : Number(row.offered_price),
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapMatch(row: DbMatch): Match {
  return {
    id: row.id,
    demandId: row.demand_id,
    sellIntentId: row.sell_intent_id ?? undefined,
    responseId: row.response_id ?? undefined,
    productId: row.product_id ?? undefined,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    status: row.status,
    createdAt: row.created_at,
  };
}
