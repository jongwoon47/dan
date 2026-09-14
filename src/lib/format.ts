import { ko } from "@/copy/ko";
import { formatWhenShort } from "@/lib/datetime";
import type { Demand } from "@/domain/types";

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}${ko.won}`;
}

/** Digits-only storage ↔ comma display for price inputs. */
export function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export function formatDigitsGrouped(digits: string): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("ko-KR");
}

export function parseMoneyInput(raw: string): number {
  const n = Number(digitsOnly(raw));
  return Number.isFinite(n) ? n : 0;
}

/** e.g. "최대 80만원까지 생각하고 있어요" */
export function formatPriceThought(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return `최대 ${formatWonShort(value)}까지 생각하고 있어요`;
}

export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = nowMs - t;
  if (diff < 45_000) return "방금";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}분 전`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))}시간 전`;
  const day = new Date(t);
  const yesterday = new Date(nowMs);
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  if (dayStart.getTime() === yesterday.getTime()) return "어제";
  return day.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function formatWonShort(value: number): string {
  if (value >= 10_000) {
    const man = value / 10_000;
    if (Number.isInteger(man)) return `${man.toLocaleString("ko-KR")}${ko.manWon}`;
    return `${man.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${ko.manWon}`;
  }
  return formatWon(value);
}

export function formatPriceRange(min: number, max: number): string {
  return `${formatWonShort(min)} ~ ${formatWonShort(max)}`;
}

export function formatRelativeCount(delta: number): string {
  if (delta > 0) return `+${delta}${ko.myung}`;
  if (delta === 0) return ko.noChange;
  return `${delta}${ko.myung}`;
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

/** Demand-first “언제” line for feed/detail. */
export function formatDemandWhen(demand: Demand): string | null {
  if (demand.type === "BORROW") {
    const start = formatWhenShort(demand.details.startAt);
    const end = formatWhenShort(demand.details.endAt);
    if (start && end) return `${start} ~ ${end}`;
    return start ?? end;
  }
  if (demand.type === "TASK") return formatWhenShort(demand.details.dueAt);
  if (demand.type === "SERVICE") return formatWhenShort(demand.details.preferredAt);
  return null;
}

export function budgetLabelForType(type: Demand["type"]): string {
  if (type === "BUY") return ko.maxPrice;
  if (type === "BORROW") return ko.borrowBudgetTotal;
  if (type === "TASK" || type === "SERVICE") return ko.reward;
  return ko.budgetLabel;
}
