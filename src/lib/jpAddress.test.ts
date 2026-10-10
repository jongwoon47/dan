import { describe, expect, it } from "vitest";
import {
  formatInstantInMarket,
  isJpPostalCode,
  looksLikeJpPrefecture,
  marketTimeZone,
} from "./jpAddress";

describe("jpAddress scaffolding", () => {
  it("detects postal codes that must not be saved as living areas", () => {
    expect(isJpPostalCode("〒812-0012")).toBe(true);
    expect(isJpPostalCode("8120012")).toBe(true);
    expect(isJpPostalCode("博多区")).toBe(false);
  });

  it("recognizes prefecture labels without enabling JP writes", () => {
    expect(looksLikeJpPrefecture("福岡県")).toBe(true);
    expect(looksLikeJpPrefecture("東京都")).toBe(true);
    expect(looksLikeJpPrefecture("성동구")).toBe(false);
  });

  it("keeps market timezone independent of UI language", () => {
    expect(marketTimeZone("JP")).toBe("Asia/Tokyo");
    expect(marketTimeZone("KR")).toBe("Asia/Seoul");
    const shown = formatInstantInMarket("2026-10-09T03:00:00.000Z", "JP", "ko");
    expect(shown.length).toBeGreaterThan(0);
  });
});
