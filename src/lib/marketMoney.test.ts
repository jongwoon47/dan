import { describe, expect, it } from "vitest";
import { formatStoredMoney } from "./format";

describe("stored marketplace currencies", () => {
  it("never converts Korean KRW to JPY merely because Japanese UI is selected", () => {
    const displayed = formatStoredMoney(12000, "KRW", "ja");
    expect(displayed).toContain("12,000");
    expect(displayed).toMatch(/₩|KRW/);
    expect(displayed).not.toContain("¥");
  });
  it("respects explicit JPY and keeps its numeric amount unchanged", () => {
    const displayed = formatStoredMoney(12000, "JPY", "ja");
    expect(displayed).toContain("12,000");
    expect(displayed).toMatch(/¥|￥/);
  });
});
