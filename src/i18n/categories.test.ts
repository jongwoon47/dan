import { describe, expect, it } from "vitest";
import { categoryLabel, conditionLabel, tradeLabel } from "./categories";

describe("conditionLabel / tradeLabel", () => {
  it("returns Korean labels from domain constants", () => {
    expect(conditionLabel("ko", "sealed")).toBe("미개봉");
    expect(conditionLabel("ko", "any")).toBe("상관없음");
    expect(tradeLabel("ko", "meetup")).toBe("직거래");
    expect(tradeLabel("ko", "shipping")).toBe("택배");
  });

  it("returns Japanese display labels without mutating domain values", () => {
    expect(conditionLabel("ja", "sealed")).toBe("未開封");
    expect(conditionLabel("ja", "like_new")).toBe("ほぼ新品");
    expect(conditionLabel("ja", "lightly_used")).toBe("使用感少なめ");
    expect(conditionLabel("ja", "any")).toBe("こだわらない");
    expect(tradeLabel("ja", "meetup")).toBe("手渡し");
    expect(tradeLabel("ja", "shipping")).toBe("配送");
    expect(tradeLabel("ja", "any")).toBe("こだわらない");
  });

  it("keeps categoryLabel available alongside condition/trade helpers", () => {
    expect(categoryLabel("ja", "electronics")).toContain("電子");
    expect(categoryLabel("ko", "electronics")).toBeTruthy();
  });
});
