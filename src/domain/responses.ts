import type { Demand, Response } from "./types";
import { isDemandLive } from "./demands";

export function upsertOpenResponse(
  responses: Response[],
  next: Response,
): { list: Response[]; result: Response } {
  const existingIndex = responses.findIndex(
    (r) =>
      r.demandId === next.demandId &&
      r.userId === next.userId &&
      r.status === "OPEN",
  );
  if (existingIndex === -1) {
    return { list: [next, ...responses], result: next };
  }
  const existing = responses[existingIndex]!;
  const updated: Response = {
    ...existing,
    message: next.message,
    offeredPrice: next.offeredPrice,
    status: "OPEN",
  };
  const copy = [...responses];
  copy[existingIndex] = updated;
  return { list: copy, result: updated };
}

export function canRespondToDemand(
  demand: Demand,
  actorId: string,
  nowMs: number,
): boolean {
  if (!isDemandLive(demand, nowMs)) return false;
  if (demand.userId === actorId) return false;
  return true;
}
