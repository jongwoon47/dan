import { createContext, useContext } from "react";

import type {
  ConditionPreference,
  Demand,
  DemandAggregate,
  DemandType,
  FeedItem,
  ItemCondition,
  Match,
  Ownership,
  Product,
  Response,
  SellIntent,
  TradeMethod,
  User,
} from "./types";
import type { DanState } from "./storeTypes";

export type { DanState } from "./storeTypes";

export type CreateDemandInput =
  | {
      type: "BUY";
      title: string;
      description?: string;
      productId: string;
      maxPrice: number;
      conditionPreference: ConditionPreference;
      location: string;
      tradeMethod: TradeMethod;
    }
  | {
      type: "BORROW";
      title: string;
      description?: string;
      itemName: string;
      budget: number;
      location: string;
      startAt?: string;
      endAt?: string;
    }
  | {
      type: "TASK";
      title: string;
      description?: string;
      taskDescription: string;
      budget: number;
      location: string;
      dueAt?: string;
    }
  | {
      type: "SERVICE";
      title: string;
      description?: string;
      serviceDescription: string;
      budget: number;
      location: string;
      preferredAt?: string;
    };

export interface DanContextValue {
  state: DanState;
  products: Product[];
  users: User[];
  currentUser: User | null;
  isLoggedIn: boolean;
  login: (userId?: string) => void;
  logout: () => void;
  createDemand: (payload: CreateDemandInput) => Promise<Demand | null>;
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
  }) => Promise<Response | null>;
  acceptResponse: (responseId: string) => Promise<Match | null>;
  expressBuyerInterest: (matchId: string) => Promise<boolean>;
  connectAsSeller: (matchId: string) => Promise<boolean>;
  getProduct: (id: string) => Product | undefined;
  getDemand: (id: string) => Demand | undefined;
  getAggregate: (productId: string) => DemandAggregate | null;
  demandFeed: FeedItem[];
  myDemands: Demand[];
  myOwnerships: Ownership[];
  mySellIntents: SellIntent[];
  myResponses: Response[];
  myMatches: Match[];
  resetDemo: () => void;
}

export const DanContext = createContext<DanContextValue | null>(null);

export function useDan() {
  const ctx = useContext(DanContext);
  if (!ctx) throw new Error("useDan must be used within DanProvider");
  return ctx;
}

export type { DemandType };
