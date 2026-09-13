import { createContext, useContext } from "react";

import type {
  ConditionPreference,
  Demand,
  DemandAggregate,
  ItemCondition,
  Match,
  Ownership,
  Product,
  SellIntent,
  TradeMethod,
  User,
} from "./types";
import type { DanState } from "./storeTypes";

export type { DanState } from "./storeTypes";

export interface DemandFeedRow extends DemandAggregate {
  product: Product;
}

export interface DanContextValue {
  state: DanState;
  products: Product[];
  users: User[];
  currentUser: User | null;
  isLoggedIn: boolean;
  login: (userId?: string) => void;
  logout: () => void;
  createDemand: (payload: {
    productId: string;
    maxPrice: number;
    conditionPreference: ConditionPreference;
    location: string;
    tradeMethod: TradeMethod;
  }) => Demand | null;
  createOwnership: (payload: {
    productId: string;
    condition: ItemCondition;
  }) => Ownership | null;
  createSellIntent: (payload: {
    ownershipId: string;
    minimumPrice: number;
  }) => SellIntent | null;
  expressBuyerInterest: (matchId: string) => void;
  connectAsSeller: (matchId: string) => void;
  getProduct: (id: string) => Product | undefined;
  getAggregate: (productId: string) => DemandAggregate | null;
  demandFeed: DemandFeedRow[];
  myDemands: Demand[];
  myOwnerships: Ownership[];
  mySellIntents: SellIntent[];
  myMatches: Match[];
  resetDemo: () => void;
}

export const DanContext = createContext<DanContextValue | null>(null);

export function useDan() {
  const ctx = useContext(DanContext);
  if (!ctx) throw new Error("useDan must be used within DanProvider");
  return ctx;
}
