/** Local `datetime-local` value ↔ ISO helpers */

export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Allow ~1 minute clock skew; reject clearly past datetimes. */
export function isDatetimeLocalNotPast(
  value: string,
  nowMs: number = Date.now(),
): boolean {
  const iso = fromDatetimeLocalValue(value);
  if (!iso) return false;
  return new Date(iso).getTime() >= nowMs - 60_000;
}

export function isBorrowRangeValid(startLocal: string, endLocal: string): boolean {
  const start = fromDatetimeLocalValue(startLocal);
  const end = fromDatetimeLocalValue(endLocal);
  if (!start || !end) return false;
  return new Date(end).getTime() > new Date(start).getTime();
}

export function formatWhenShort(
  iso?: string | null,
  language: "ko" | "ja" = "ko",
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(language === "ja" ? "ja-JP" : "ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateMedium(
  iso: string,
  language: "ko" | "ja" = "ko",
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(language === "ja" ? "ja-JP" : "ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
