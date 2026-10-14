/**
 * Japan address scaffolding for display / validation hints only.
 * Does not invent prefecture as a DB column and never unlocks JP demand writes.
 */

export const JP_PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export type JpPrefecture = (typeof JP_PREFECTURES)[number];

/** JP postal codes: NNN-NNNN or NNNNNNN. Rejects as living-area label (too precise). */
export function isJpPostalCode(value: string): boolean {
  const normalized = value.normalize("NFKC").replace(/\s+/g, "");
  return /^(〒)?\d{3}-?\d{4}$/.test(normalized);
}

export function looksLikeJpPrefecture(value: string): boolean {
  const normalized = value.normalize("NFKC").trim();
  return (JP_PREFECTURES as readonly string[]).some(
    (pref) => normalized === pref || normalized.startsWith(pref.replace(/(都|道|府|県)$/u, "")),
  );
}

/** Market → IANA timezone for display only (never converts stored money). */
export function marketTimeZone(country: "KR" | "JP"): string {
  return country === "JP" ? "Asia/Tokyo" : "Asia/Seoul";
}

export function formatInstantInMarket(
  iso: string,
  country: "KR" | "JP",
  language: "ko" | "ja",
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(language === "ja" ? "ja-JP" : "ko-KR", {
    timeZone: marketTimeZone(country),
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
