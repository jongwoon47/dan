import { ko } from "@/copy/ko";

export type ProductCategory = "camera" | "lens" | "electronics";
export type ItemCondition = "sealed" | "like_new" | "lightly_used";
export type ConditionPreference = ItemCondition | "any";
export type TradeMethod = "meetup" | "shipping" | "any";
export type DemandStatus = "ACTIVE" | "MATCHED" | "CLOSED" | "EXPIRED";
export type OwnershipStatus = "OWNED" | "RELEASED";
export type SellIntentStatus = "OPEN" | "PAUSED" | "MATCHED" | "CLOSED";
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
  location: string;
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

export interface Demand {
  id: string;
  userId: string;
  productId: string;
  maxPrice: number;
  conditionPreference: ConditionPreference;
  location: string;
  tradeMethod: TradeMethod;
  status: DemandStatus;
  createdAt: string;
  expiresAt: string;
}

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

export interface Match {
  id: string;
  demandId: string;
  sellIntentId: string;
  productId: string;
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
}

export interface PriceBucket {
  label: string;
  count: number;
  min: number;
  max: number | null;
}

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  camera: ko.camera,
  lens: ko.lens,
  electronics: ko.electronics,
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
