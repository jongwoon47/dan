import type { Demand, DemandStatus } from "@/domain/types";

const BUY_TTL_MS = 30 * 86400000;

/** Default expires_at when creating a demand. Timed types expire at schedule. */
export function defaultExpiresAtIso(
  type: Demand["type"],
  scheduleIso?: string | null,
  nowMs: number = Date.now(),
): string {
  if (
    (type === "SERVICE" || type === "TASK" || type === "BORROW") &&
    scheduleIso
  ) {
    const t = new Date(scheduleIso).getTime();
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return new Date(nowMs + BUY_TTL_MS).toISOString();
}

export function isDemandPastSchedule(
  demand: Demand,
  nowMs: number = Date.now(),
): boolean {
  if (new Date(demand.expiresAt).getTime() <= nowMs) return true;
  if (demand.type === "SERVICE" && demand.details.preferredAt) {
    return new Date(demand.details.preferredAt).getTime() <= nowMs;
  }
  if (demand.type === "TASK" && demand.details.dueAt) {
    return new Date(demand.details.dueAt).getTime() <= nowMs;
  }
  if (demand.type === "BORROW" && demand.details.endAt) {
    return new Date(demand.details.endAt).getTime() <= nowMs;
  }
  return false;
}

/** UI/status view — ACTIVE past schedule reads as EXPIRED without waiting for a job. */
export function effectiveDemandStatus(
  demand: Demand,
  nowMs: number = Date.now(),
): DemandStatus {
  if (
    demand.status === "CLOSED" ||
    demand.status === "MATCHED" ||
    demand.status === "EXPIRED"
  ) {
    return demand.status;
  }
  if (isDemandPastSchedule(demand, nowMs)) return "EXPIRED";
  return "ACTIVE";
}

export function isDemandOpen(
  demand: Demand,
  nowMs: number = Date.now(),
): boolean {
  return effectiveDemandStatus(demand, nowMs) === "ACTIVE";
}
