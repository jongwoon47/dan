import type {
  BuyDemand,
  DealDispute,
  DealEvidence,
  DealSnapshot,
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
  areFulfillmentOptionsValid,
  fulfillmentFromLegacyLocation,
  stripGeoFromFulfillmentOptions,
  type FulfillmentOption,
} from "@/domain/fulfillment";

export function parseFulfillmentOptions(
  raw: unknown,
  legacyLocation: string,
): FulfillmentOption[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (Array.isArray(parsed) && areFulfillmentOptionsValid(parsed as FulfillmentOption[])) {
    return stripGeoFromFulfillmentOptions(parsed as FulfillmentOption[]);
  }
  return fulfillmentFromLegacyLocation(legacyLocation ?? "");
}

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
  estimated_duration_minutes?: number | null;
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
  target_demand_id?: string | null;
  approx_usage_count?: number | null;
  condition_note?: string | null;
  quick_photo_url?: string | null;
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
  availability_text?: string | null;
  status: Response["status"];
  created_at: string;
  updated_at: string;
};

export type DbDealDispute = {
  id: string;
  match_id: string;
  opened_by: string;
  reason: DealDispute["reason"];
  detail: string;
  status: DealDispute["status"];
  attributed_fault: DealDispute["attributedFault"] | null;
  resolution_note: string;
  created_at: string;
  resolved_at: string | null;
};

export type DbDealEvidence = {
  id: string;
  match_id: string;
  seller_id: string;
  possession_photo_url: string | null;
  serial_last4: string | null;
  usage_count: number | null;
  purchase_date: string | null;
  warranty_until: string | null;
  components: unknown;
  cosmetic_notes: string;
  known_issues: string;
  repair_history: string;
  water_damage_statement: string;
  evidence_meta: unknown;
  submitted_at: string;
  updated_at: string;
};

export type DbDealSnapshot = {
  id: string;
  match_id: string;
  demand_id: string;
  product_id: string | null;
  buyer_id: string;
  seller_id: string;
  agreed_price: number;
  snapshot: unknown;
  buyer_confirmed_at: string | null;
  seller_confirmed_at: string | null;
  locked_at: string | null;
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
  deal_stage?: Match["dealStage"] | null;
  payment_status?: Match["paymentStatus"] | null;
  payment_due_at?: string | null;
  cancel_reason?: Match["cancelReason"] | null;
  cancelled_by?: string | null;
  cancel_fault_party?: Match["cancelFaultParty"] | null;
  created_at: string;
  updated_at: string;
  buyer_completed_at?: string | null;
  seller_completed_at?: string | null;
  completed_at?: string | null;
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
  const fulfillmentOptions = parseFulfillmentOptions(
    row.fulfillment_options,
    row.location ?? "",
  );

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
      estimatedDurationMinutes:
        row.estimated_duration_minutes == null
          ? undefined
          : Number(row.estimated_duration_minutes),
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
    targetDemandId: row.target_demand_id ?? undefined,
    approxUsageCount:
      row.approx_usage_count == null ? undefined : Number(row.approx_usage_count),
    conditionNote: row.condition_note?.trim() || undefined,
    quickPhotoUrl: row.quick_photo_url?.trim() || undefined,
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
    availabilityText: row.availability_text?.trim() || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapDealDispute(row: DbDealDispute): DealDispute {
  return {
    id: row.id,
    matchId: row.match_id,
    openedBy: row.opened_by,
    reason: row.reason,
    detail: row.detail ?? "",
    status: row.status,
    attributedFault: row.attributed_fault ?? undefined,
    resolutionNote: row.resolution_note ?? "",
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

export function mapDealEvidence(row: DbDealEvidence): DealEvidence {
  return {
    id: row.id,
    matchId: row.match_id,
    sellerId: row.seller_id,
    possessionPhotoUrl: row.possession_photo_url ?? undefined,
    serialLast4: row.serial_last4 ?? undefined,
    usageCount: row.usage_count == null ? undefined : Number(row.usage_count),
    purchaseDate: row.purchase_date ?? undefined,
    warrantyUntil: row.warranty_until ?? undefined,
    components: Array.isArray(row.components)
      ? row.components.filter((x): x is string => typeof x === "string")
      : [],
    cosmeticNotes: row.cosmetic_notes ?? "",
    knownIssues: row.known_issues ?? "",
    repairHistory: row.repair_history ?? "",
    waterDamageStatement: row.water_damage_statement ?? "",
    evidenceMeta:
      row.evidence_meta && typeof row.evidence_meta === "object"
        ? (row.evidence_meta as Record<string, unknown>)
        : {},
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  };
}

export function mapDealSnapshot(row: DbDealSnapshot): DealSnapshot {
  return {
    id: row.id,
    matchId: row.match_id,
    demandId: row.demand_id,
    productId: row.product_id ?? undefined,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    agreedPrice: Number(row.agreed_price),
    snapshot:
      row.snapshot && typeof row.snapshot === "object"
        ? (row.snapshot as Record<string, unknown>)
        : {},
    buyerConfirmedAt: row.buyer_confirmed_at ?? undefined,
    sellerConfirmedAt: row.seller_confirmed_at ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    dealStage: row.deal_stage ?? undefined,
    paymentStatus: row.payment_status ?? undefined,
    paymentDueAt: row.payment_due_at ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    cancelFaultParty: row.cancel_fault_party ?? undefined,
    createdAt: row.created_at,
    buyerCompletedAt: row.buyer_completed_at ?? undefined,
    sellerCompletedAt: row.seller_completed_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}
