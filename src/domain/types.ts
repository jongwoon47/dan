import { ko } from "@/copy/ko";
import type { FulfillmentOption } from "./fulfillment";

export type DemandType = "BUY" | "BORROW" | "TASK" | "SERVICE";

export type ProductCategory =
  | "electronics"
  | "camera"
  | "lens"
  | "furniture"
  | "camping"
  | "other";

export type DemandCategory =
  | ProductCategory
  | "errand"
  | "service"
  | "rental";

export type ItemCondition = "sealed" | "like_new" | "lightly_used";
export type ConditionPreference = ItemCondition | "any";
export type TradeMethod = "meetup" | "shipping" | "any";
export type DemandStatus = "ACTIVE" | "MATCHED" | "CLOSED" | "EXPIRED";
export type OwnershipStatus = "OWNED" | "RELEASED";
export type SellIntentStatus = "OPEN" | "PAUSED" | "MATCHED" | "CLOSED";
export type ResponseStatus = "OPEN" | "ACCEPTED" | "WITHDRAWN";
export type MatchStatus =
  | "POTENTIAL"
  | "BUYER_INTERESTED"
  | "SELLER_ACCEPTED"
  | "CONNECTED"
  | "DECLINED"
  | "CLOSED";

export interface User {
  id: string;
  name: string;
  /** Profile default area ? input/filter default only, not matching truth. */
  defaultArea: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: ProductCategory;
  imageHue: number;
  createdAt: string;
}

export interface DemandBase {
  id: string;
  userId: string;
  type: DemandType;
  title: string;
  description: string;
  category: DemandCategory;
  budget: number;
  /** How this demand can be fulfilled (not profile residence). */
  fulfillmentOptions: FulfillmentOption[];
  status: DemandStatus;
  createdAt: string;
  expiresAt: string;
}

export interface BuyDemandDetails {
  productId: string;
  maxPrice: number;
  conditionPreference: ConditionPreference;
  /** Derived from fulfillmentOptions for BUY matching. */
  tradeMethod: TradeMethod;
}

export interface BorrowDemandDetails {
  itemName: string;
  startAt?: string;
  endAt?: string;
}

export interface TaskDemandDetails {
  taskDescription: string;
  dueAt?: string;
}

export interface ServiceDemandDetails {
  serviceDescription: string;
  preferredAt?: string;
}

export type BuyDemand = DemandBase & {
  type: "BUY";
  details: BuyDemandDetails;
};

export type BorrowDemand = DemandBase & {
  type: "BORROW";
  details: BorrowDemandDetails;
};

export type TaskDemand = DemandBase & {
  type: "TASK";
  details: TaskDemandDetails;
};

export type ServiceDemand = DemandBase & {
  type: "SERVICE";
  details: ServiceDemandDetails;
};

export type Demand = BuyDemand | BorrowDemand | TaskDemand | ServiceDemand;

export interface Ownership {
  id: string;
  userId: string;
  productId: string;
  condition: ItemCondition;
  status: OwnershipStatus;
  createdAt: string;
}

export interface SellIntent {
  id: string;
  ownershipId: string;
  userId: string;
  productId: string;
  minimumPrice: number;
  status: SellIntentStatus;
  createdAt: string;
}

export interface Response {
  id: string;
  demandId: string;
  userId: string;
  message: string;
  offeredPrice?: number;
  status: ResponseStatus;
  createdAt: string;
}

export interface Match {
  id: string;
  demandId: string;
  sellIntentId?: string;
  responseId?: string;
  productId?: string;
  buyerId: string;
  sellerId: string;
  status: MatchStatus;
  createdAt: string;
}

export interface DemandAggregate {
  productId: string;
  seekerCount: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  recent7dDelta: number;
  highestIntentPrice: number;
  priceBuckets: PriceBucket[];
  fulfillmentSummary?: string;
}

export interface PriceBucket {
  label: string;
  count: number;
  min: number;
  max: number | null;
}

export type FeedItem =
  | {
      kind: "aggregated";
      id: string;
      product: Product;
      aggregate: DemandAggregate;
      sortAt: string;
    }
  | {
      kind: "individual";
      id: string;
      demand: Demand;
      sortAt: string;
    };

export const DEMAND_TYPE_LABEL: Record<DemandType, string> = {
  BUY: ko.typeBuy,
  BORROW: ko.typeBorrow,
  TASK: ko.typeTask,
  SERVICE: ko.typeService,
};

export const CATEGORY_LABEL: Record<DemandCategory, string> = {
  camera: ko.camera,
  lens: ko.lens,
  electronics: ko.electronics,
  furniture: ko.furniture,
  camping: ko.camping,
  other: ko.other,
  errand: ko.errand,
  service: ko.serviceCat,
  rental: ko.rental,
};

export const CONDITION_LABEL: Record<ConditionPreference, string> = {
  sealed: ko.sealed,
  like_new: ko.likeNew,
  lightly_used: ko.lightlyUsed,
  any: ko.any,
};

export const TRADE_LABEL: Record<TradeMethod, string> = {
  meetup: ko.meetup,
  shipping: ko.shipping,
  any: ko.any,
};

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  POTENTIAL: ko.matchStatusPotential,
  BUYER_INTERESTED: ko.matchStatusInterested,
  SELLER_ACCEPTED: ko.matchStatusAccepted,
  CONNECTED: ko.matchStatusConnected,
  DECLINED: ko.matchStatusDeclined,
  CLOSED: ko.matchStatusClosed,
};

export function isBuyDemand(demand: Demand): demand is BuyDemand {
  return demand.type === "BUY";
}

export function isIndividualDemandType(type: DemandType): boolean {
  return type === "BORROW" || type === "TASK" || type === "SERVICE";
}

export type {
  FulfillmentMode,
  FulfillmentOption,
  Place,
  FeedAreaFilter,
} from "./fulfillment";
