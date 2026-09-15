import { createContext, useContext } from "react";

import type { CreateDemandInput } from "./createDemand";
import type { FulfillmentOption } from "./fulfillment";
import type {
  ActivityEvent,
  ChatMessage,
  Demand,
  DemandAggregate,
  DemandType,
  FeedItem,
  ItemCondition,
  Match,
  Ownership,
  Product,
  PublicProfile,
  Response,
  SellIntent,
  User,
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
  login: (userId?: string) => void;
  logout: () => void;
  createDemand: (payload: CreateDemandInput) => Promise<Demand | null>;
  ensureProduct: (name: string) => Promise<Product | null>;
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
  /** BUY only — soft-expired ACTIVE row gets +30d. No auto-repost. */
  extendBuyDemand: (demandId: string) => Promise<Demand | null>;
  createOwnership: (payload: {
    productId: string;
    condition: ItemCondition;
  }) => Promise<Ownership | null>;
  createSellIntent: (payload: {
    ownershipId: string;
    minimumPrice: number;
  }) => Promise<SellIntent | null>;
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
  listMessages: (matchId: string) => Promise<ChatMessage[]>;
  sendMessage: (matchId: string, body: string) => Promise<ChatMessage | null>;
  markMessagesRead: (matchId: string) => Promise<void>;
  activities: ActivityEvent[];
  unreadActivityCount: number;
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
