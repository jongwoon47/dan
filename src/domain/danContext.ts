import { createContext, useContext } from "react";

import type { CreateDemandInput } from "./createDemand";
import type { FulfillmentOption } from "./fulfillment";
import type {
  ActivityEvent,
  ChatMessage,
  Demand,
  DemandAggregate,
  CancelReason,
  DealDispute,
  DealEvidence,
  DealEvidenceChallenge,
  DealSnapshot,
  DemandType,
  FeedItem,
  ItemCondition,
  Match,
  Ownership,
  Product,
  ProductCategory,
  PublicProfile,
  Response,
  SellIntent,
  User,
  UserVerificationStatus,
} from "./types";
import type { DanState } from "./storeTypes";

export type { DanState } from "./storeTypes";
export type { CreateDemandInput } from "./createDemand";

export interface DanContextValue {
  state: DanState;
  products: Product[];
  users: User[];
  currentUser: User | null;
  isLoggedIn: boolean;
  getMyVerification: () => Promise<UserVerificationStatus>;
  login: (userId?: string) => void;
  logout: () => void;
  createDemand: (payload: CreateDemandInput) => Promise<Demand | null>;
  ensureProduct: (name: string, category?: ProductCategory) => Promise<Product | null>;
  updateDemand: (payload: {
    demandId: string;
    title: string;
    description: string;
    budget: number;
    fulfillmentOptions: FulfillmentOption[];
    expiresAt?: string;
    dueAt?: string;
    startAt?: string;
    endAt?: string;
    preferredAt?: string;
    itemName?: string;
    taskDescription?: string;
    serviceDescription?: string;
    maxPrice?: number;
    conditionPreference?: string;
    tradeMethod?: string;
  }) => Promise<Demand | null>;
  closeDemand: (demandId: string) => Promise<Demand | null>;
  /** BUY only — user-confirmed Live Demand gets +7d. No auto-repost. */
  extendBuyDemand: (demandId: string) => Promise<Demand | null>;
  createOwnership: (payload: {
    productId: string;
    condition: ItemCondition;
  }) => Promise<Ownership | null>;
  createSellIntent: (payload: {
    ownershipId: string;
    minimumPrice: number;
    targetDemandId?: string;
    tradeMethod?: import("@/domain/types").TradeMethod;
    approxUsageCount?: number;
    conditionNote?: string;
    quickPhotoUrl?: string;
  }) => Promise<SellIntent | null>;
  issueDealEvidenceChallenge: (matchId: string) => Promise<DealEvidenceChallenge | null>;
  getDealEvidence: (matchId: string) => Promise<DealEvidence | null>;
  upsertDealEvidence: (payload: {
    matchId: string;
    challengeCode: string;
    possessionPhotoUrl?: string;
    serialLast4?: string;
    usageCount?: number;
    purchaseDate?: string;
    warrantyUntil?: string;
    components?: string[];
    cosmeticNotes?: string;
    knownIssues?: string;
    repairHistory?: string;
    waterDamageStatement?: string;
    evidenceMeta?: Record<string, unknown>;
  }) => Promise<DealEvidence | null>;
  getDealSnapshot: (matchId: string) => Promise<DealSnapshot | null>;
  confirmDealSnapshot: (payload: {
    matchId: string;
    agreedPrice: number;
    snapshot: Record<string, unknown>;
  }) => Promise<DealSnapshot | null>;
  listDealDisputes: (matchId: string) => Promise<DealDispute[]>;
  openDealDispute: (payload: {
    matchId: string;
    reason: DealDispute["reason"];
    detail?: string;
  }) => Promise<DealDispute | null>;
  cancelDeal: (payload: {
    matchId: string;
    reason: CancelReason;
  }) => Promise<Match | null>;
  /** Demo-only visual QA helper. Supabase mode always returns false. */
  simulateSafePaymentDemo: (matchId: string) => Promise<boolean>;
  createResponse: (payload: {
    demandId: string;
    message: string;
    offeredPrice?: number;
    availabilityText?: string;
  }) => Promise<Response | null>;
  withdrawResponse: (responseId: string) => Promise<Response | null>;
  declineResponse: (responseId: string) => Promise<Response | null>;
  acceptResponse: (responseId: string) => Promise<Match | null>;
  expressBuyerInterest: (matchId: string) => Promise<boolean>;
  connectAsSeller: (matchId: string) => Promise<boolean>;
  confirmMatchCompletion: (matchId: string) => Promise<Match | null>;
  closeMatch: (matchId: string) => Promise<Match | null>;
  /** After CLOSED match: demand owner reactivates MATCHED → ACTIVE. */
  reopenDemandAfterTradeClose: (matchId: string) => Promise<Demand | null>;
  listMessages: (matchId: string) => Promise<ChatMessage[]>;
  sendMessage: (matchId: string, body: string) => Promise<ChatMessage | null>;
  markMessagesRead: (matchId: string) => Promise<void>;
  activities: ActivityEvent[];
  unreadActivityCount: number;
  /** Unread NEW_MESSAGE only — for 대화 badge. */
  unreadChatCount: number;
  /** Unread non-message activity — for My DAN badge. */
  unreadMyDanCount: number;
  refreshActivities: () => Promise<void>;
  markActivityRead: (activityId?: string) => Promise<void>;
  getPublicProfile: (userId: string) => Promise<PublicProfile | null>;
  updateMyProfile: (payload: {
    displayName: string;
    defaultArea: string;
    bio: string;
  }) => Promise<User | null>;
  blockUser: (userId: string) => Promise<boolean>;
  reportUser: (payload: {
    targetUserId: string;
    reason: "spam" | "fraud" | "abuse" | "other";
    detail?: string;
  }) => Promise<boolean>;
  getProduct: (id: string) => Product | undefined;
  getDemand: (id: string) => Demand | undefined;
  getAggregate: (productId: string) => DemandAggregate | null;
  demandFeed: FeedItem[];
  myDemands: Demand[];
  myOwnerships: Ownership[];
  mySellIntents: SellIntent[];
  myResponses: Response[];
  myMatches: Match[];
  busy: boolean;
  loadError: string | null;
  resetDemo: () => void;
}

export const DanContext = createContext<DanContextValue | null>(null);

export function useDan() {
  const ctx = useContext(DanContext);
  if (!ctx) throw new Error("useDan must be used within DanProvider");
  return ctx;
}

export type { DemandType };
