import { ko } from "@/copy/ko";
import { formatWhenShort } from "@/lib/datetime";
import type { Demand } from "@/domain/types";

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}${ko.won}`;
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
