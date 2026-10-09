import { ko } from "@/copy/ko";
import { formatWhenShort } from "@/lib/datetime";
import type { Demand } from "@/domain/types";

export type FormatLanguage = "ko" | "ja";

/** Until Japan multi-currency accounting ships, all live amounts remain KRW. */
/** Display actual stored currency, without any conversion. */
export function formatStoredMoney(value: number, currency: "KRW" | "JPY", language: FormatLanguage): string {
  if (!Number.isFinite(value)) return "";
  if (currency === "KRW") return formatKRWForLanguage(value, language);
  return new Intl.NumberFormat(language === "ja" ? "ja-JP" : "ko-KR", {
    style: "currency", currency: "JPY", maximumFractionDigits: 0,
  }).format(value);
}

export function formatKRWForLanguage(value: number, language: FormatLanguage): string {
  if (!Number.isFinite(value)) return "";
  return language === "ja"
    ? new Intl.NumberFormat("ja-JP", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value)
    : formatWon(value);
}

export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}${ko.won}`;
}

/** Digits-only storage ↔ comma display for price inputs. */
export function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export function formatDigitsGrouped(digits: string, language: FormatLanguage = "ko"): string {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(language === "ja" ? "ja-JP" : "ko-KR");
}

export function parseMoneyInput(raw: string): number {
  const n = Number(digitsOnly(raw));
  return Number.isFinite(n) ? n : 0;
}

/** e.g. BUY: "최대 80만원까지 생각하고 있어요" */
export function formatPriceThought(
  value: number,
  kind: "buy" | "borrow" | "reward" = "buy",
  language: FormatLanguage = "ko",
): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const price = formatWonShort(value, language);
  if (language === "ja") {
    if (kind === "borrow") return `合計 ${price}まで使えます`;
    if (kind === "reward") return `謝礼は ${price} くらいです`;
    return `最大 ${price} まで考えています`;
  }
  if (kind === "borrow") return `총 ${price}까지 쓸 수 있어요`;
  if (kind === "reward") return `보상은 ${price} 정도예요`;
  return `최대 ${price}까지 생각하고 있어요`;
}

export function formatRelativeTime(
  iso: string,
  language: FormatLanguage = "ko",
  nowMs: number = Date.now(),
): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = nowMs - t;
  if (diff < 45_000) return language === "ja" ? "たった今" : "방금";
  if (diff < 3_600_000) {
    const n = Math.max(1, Math.floor(diff / 60_000));
    return language === "ja" ? `${n}分前` : `${n}분 전`;
  }
  if (diff < 86_400_000) {
    const n = Math.max(1, Math.floor(diff / 3_600_000));
    return language === "ja" ? `${n}時間前` : `${n}시간 전`;
  }
  const day = new Date(t);
  const yesterday = new Date(nowMs);
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  if (dayStart.getTime() === yesterday.getTime()) {
    return language === "ja" ? "昨日" : "어제";
  }
  if (diff < 7 * 86_400_000) {
    const n = Math.max(2, Math.floor(diff / 86_400_000));
    return language === "ja" ? `${n}日前` : `${n}일 전`;
  }
  return day.toLocaleDateString(language === "ja" ? "ja-JP" : "ko-KR", {
    month: "long",
    day: "numeric",
  });
}

export function formatWonShort(value: number, language: FormatLanguage = "ko"): string {
  const manLabel = language === "ja" ? "万ウォン" : ko.manWon;
  if (value >= 10_000) {
    const man = value / 10_000;
    const locale = language === "ja" ? "ja-JP" : "ko-KR";
    if (Number.isInteger(man)) return `${man.toLocaleString(locale)}${manLabel}`;
    return `${man.toLocaleString(locale, { maximumFractionDigits: 1 })}${manLabel}`;
  }
  return language === "ja" ? formatKRWForLanguage(value, "ja") : formatWon(value);
}

export function formatPriceRange(min: number, max: number, language: FormatLanguage = "ko"): string {
  return `${formatWonShort(min, language)} ~ ${formatWonShort(max, language)}`;
}

export function formatRelativeCount(delta: number, language: FormatLanguage = "ko"): string {
  const unit = language === "ja" ? "人" : ko.myung;
  if (delta > 0) return `+${delta}${unit}`;
  if (delta === 0) return language === "ja" ? "変動なし" : ko.noChange;
  return `${delta}${unit}`;
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

/** Demand-first “언제” line for feed/detail. Locale affects display only, never market/currency. */
export function formatDemandWhen(demand: Demand, language: FormatLanguage = "ko"): string | null {
  if (demand.type === "BORROW") {
    const start = formatWhenShort(demand.details.startAt, language);
    const end = formatWhenShort(demand.details.endAt, language);
    if (start && end) return `${start} ~ ${end}`;
    return start ?? end;
  }
  if (demand.type === "TASK") return formatWhenShort(demand.details.dueAt, language);
  if (demand.type === "SERVICE") return formatWhenShort(demand.details.preferredAt, language);
  return null;
}

export function formatDurationMinutes(
  minutes?: number | null,
  language: FormatLanguage = "ko",
): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const m = Math.round(minutes);
  if (language === "ja") {
    if (m < 60) return `約 ${m}分`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    if (rem === 0) return `約 ${h}時間`;
    return `約 ${h}時間 ${rem}分`;
  }
  if (m < 60) return `약 ${m}${ko.estimatedDurationUnit}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `약 ${h}시간`;
  return `약 ${h}시간 ${rem}${ko.estimatedDurationUnit}`;
}

export function budgetLabelForType(
  type: Demand["type"],
  language: FormatLanguage = "ko",
): string {
  if (language === "ja") {
    if (type === "BUY") return "希望価格の上限";
    if (type === "BORROW") return "レンタル期間全体の予算";
    if (type === "TASK" || type === "SERVICE") return "謝礼";
    return "予算・謝礼";
  }
  if (type === "BUY") return ko.maxPrice;
  if (type === "BORROW") return ko.borrowBudgetTotal;
  if (type === "TASK" || type === "SERVICE") return ko.reward;
  return ko.budgetLabel;
}
