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

export type DealStage =
  | "MATCHING"
  | "BUYER_INTERESTED"
  | "EVIDENCE_PENDING"
  | "EVIDENCE_READY"
  | "DEAL_REVIEW"
  | "DEAL_LOCKED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "HANDOFF_READY"
  | "COMPLETED"
  | "DISPUTE"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus = "NOT_STARTED" | "PENDING" | "PAID" | "REFUNDED";

export type CancelReason =
  | "BUYER_CHANGED_MIND"
  | "SELLER_CHANGED_MIND"
  | "SELLER_CHANGED_TERMS"
  | "BUYER_NO_PAYMENT"
  | "ITEM_UNAVAILABLE"
  | "MUTUAL_CANCEL"
  | "SYSTEM_CANCEL"
  | "RISK_CANCEL";

export type DealDisputeReason =
  | "ITEM_NOT_RECEIVED"
  | "WRONG_ITEM"
  | "SNAPSHOT_MISMATCH"
  | "MAJOR_UNDISCLOSED_DEFECT"
  | "OTHER";

export type DealDisputeStatus =
  | "OPEN"
  | "REVIEWING"
  | "RESOLVED_BUYER"
  | "RESOLVED_SELLER"
  | "CLOSED";

export type FaultParty = "BUYER" | "SELLER" | "NONE";
export type ResponseStatus = "OPEN" | "ACCEPTED" | "WITHDRAWN" | "DECLINED";
export type MatchStatus =
  | "POTENTIAL"
  | "BUYER_INTERESTED"
  | "SELLER_ACCEPTED"
  | "CONNECTED"
  | "DECLINED"
  | "CLOSED"
  | "COMPLETED";

export interface User {
  id: string;
  name: string;
  /** Profile default area — input/filter default only, not matching truth. */
  defaultArea: string;
  bio?: string;
  createdAt?: string;
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
  /** Optional structured duration in minutes (matching / display). */
  estimatedDurationMinutes?: number;
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
  /** Optional demand this quick offer was opened from. */
  targetDemandId?: string;
  /** Camera V1: approximate shutter count / usage count. */
  approxUsageCount?: number;
  /** Seller's short, non-verified condition statement. */
  conditionNote?: string;
  /** Optional seller-submitted current-photo URL. */
  quickPhotoUrl?: string;
  status: SellIntentStatus;
  createdAt: string;
}

export interface DealEvidence {
  id: string;
  matchId: string;
  sellerId: string;
  possessionPhotoUrl?: string;
  serialLast4?: string;
  usageCount?: number;
  purchaseDate?: string;
  warrantyUntil?: string;
  components: string[];
  cosmeticNotes: string;
  knownIssues: string;
  repairHistory: string;
  waterDamageStatement: string;
  evidenceMeta: Record<string, unknown>;
  submittedAt: string;
  updatedAt: string;
}

export interface DealSnapshot {
  id: string;
  matchId: string;
  demandId: string;
  productId?: string;
  buyerId: string;
  sellerId: string;
  agreedPrice: number;
  snapshot: Record<string, unknown>;
  buyerConfirmedAt?: string;
  sellerConfirmedAt?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}


export interface DealDispute {
  id: string;
  matchId: string;
  openedBy: string;
  reason: DealDisputeReason;
  detail: string;
  status: DealDisputeStatus;
  attributedFault?: FaultParty;
  resolutionNote: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Response {
  id: string;
  demandId: string;
  userId: string;
  message: string;
  offeredPrice?: number;
  availabilityText?: string;
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
  dealStage?: DealStage;
  paymentStatus?: PaymentStatus;
  cancelReason?: CancelReason;
  cancelledBy?: string;
  cancelFaultParty?: FaultParty;
  createdAt: string;
  buyerCompletedAt?: string;
  sellerCompletedAt?: string;
  completedAt?: string;
}

export type ActivityKind =
  | "NEW_RESPONSE"
  | "RESPONSE_ACCEPTED"
  | "RESPONSE_DECLINED"
  | "BUYER_INTEREST"
  | "MATCH_CONNECTED"
  | "NEW_MESSAGE"
  | "DEMAND_CLOSED"
  | "MATCH_COMPLETED"
  | "MATCH_TRADE_CLOSED";

export interface ActivityEvent {
  id: string;
  recipientId: string;
  actorId?: string;
  kind: ActivityKind;
  demandId?: string;
  responseId?: string;
  matchId?: string;
  readAt?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt?: string;
}

export interface PublicProfileActivity {
  id: string;
  label: string;
  href?: string;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  defaultArea: string;
  bio: string;
  createdAt: string;
  connectionCount: number;
  /** COMPLETED matches involving this user (mutual trade confirm). */
  completedDemandCount: number;
  /** CONNECTED/COMPLETED matches where this user was the responder/seller. */
  responseConnectionCount: number;
  /** Facts only; fault fields are populated only after explicit ops attribution. */
  buyerFaultCancellationCount: number;
  sellerFaultCancellationCount: number;
  unresolvedDisputeCount: number;
  confirmedMismatchCount: number;
  /** Only real auth providers — never invent verification. */
  authLabel?: string | null;
  recentActivity: PublicProfileActivity[];
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
  COMPLETED: ko.matchStatusCompleted,
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
