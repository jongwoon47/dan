import type {
  Demand,
  DealDispute,
  DealEvidence,
  DealSnapshot,
  Match,
  Ownership,
  Response,
  SellIntent,
} from "./types";

export interface DanState {
  currentUserId: string | null;
  demands: Demand[];
  ownerships: Ownership[];
  sellIntents: SellIntent[];
  responses: Response[];
  matches: Match[];
  dealEvidence: DealEvidence[];
  dealSnapshots: DealSnapshot[];
  dealDisputes: DealDispute[];
}
