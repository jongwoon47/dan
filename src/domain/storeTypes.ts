import type {
  Demand,
  Match,
  Ownership,
  SellIntent,
} from "./types";

export interface DanState {
  currentUserId: string | null;
  demands: Demand[];
  ownerships: Ownership[];
  sellIntents: SellIntent[];
  matches: Match[];
}
