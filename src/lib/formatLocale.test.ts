import { describe, expect, it } from "vitest";
import { budgetLabelForType, formatDigitsGrouped } from "./format";

describe("formatDigitsGrouped", () => {
  it("groups with Korean locale by default", () => {
    expect(formatDigitsGrouped("800000")).toBe("800,000");
    expect(formatDigitsGrouped("800000", "ko")).toBe("800,000");
  });

  it("groups with Japanese locale when language is ja", () => {
    expect(formatDigitsGrouped("800000", "ja")).toBe("800,000");
    expect(formatDigitsGrouped("1234567", "ja")).toBe("1,234,567");
  });

  it("returns empty string for empty or non-finite input", () => {
    expect(formatDigitsGrouped("")).toBe("");
    expect(formatDigitsGrouped("abc", "ja")).toBe("");
  });
});

describe("budgetLabelForType", () => {
  it("returns Korean budget labels by default", () => {
    expect(budgetLabelForType("BUY")).toBe("희망 가격 (최대)");
    expect(budgetLabelForType("BORROW")).toBe("대여 총 예산");
    expect(budgetLabelForType("TASK")).toBe("보상");
    expect(budgetLabelForType("SERVICE")).toBe("보상");
  });

  it("returns Japanese budget labels when language is ja", () => {
    expect(budgetLabelForType("BUY", "ja")).toBe("希望価格の上限");
    expect(budgetLabelForType("BORROW", "ja")).toBe("レンタル期間全体の予算");
    expect(budgetLabelForType("TASK", "ja")).toBe("謝礼");
    expect(budgetLabelForType("SERVICE", "ja")).toBe("謝礼");
  });
});
