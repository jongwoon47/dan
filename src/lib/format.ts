import { ko } from "@/copy/ko";

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
