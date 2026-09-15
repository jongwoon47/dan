import { describe, expect, it } from "vitest";
import {
  filterProductSuggestions,
  findProductByMatchKey,
  productMatchKey,
} from "@/domain/productName";

const CATALOG = [
  { id: "1", name: "iPhone 15 Pro" },
  { id: "2", name: "AirPods Pro 2" },
  { id: "3", name: "Nintendo Switch OLED" },
  { id: "4", name: "Sony A7 IV" },
  { id: "5", name: "MacBook Pro 14 M4" },
  { id: "6", name: "Sony FE 24-70mm F2.8 GM II" },
];

describe("productMatchKey", () => {
  it("collapses case and spacing for the same product", () => {
    expect(productMatchKey("iPhone 15 Pro")).toBe(
      productMatchKey("iphone 15 pro"),
    );
    expect(productMatchKey("iPhone-15-Pro")).toBe(
      productMatchKey("iPhone 15 Pro"),
    );
  });

  it("maps common Hangul aliases onto Latin keys", () => {
    expect(productMatchKey("아이폰15프로")).toBe(
      productMatchKey("iPhone 15 Pro"),
    );
    expect(productMatchKey("에어팟 프로 2")).toBe(
      productMatchKey("AirPods Pro 2"),
    );
  });

  it("finds catalog rows by match key", () => {
    const products = [
      { id: "1", name: "iPhone 15 Pro" },
      { id: "2", name: "MacBook Pro 14 M4" },
    ];
    expect(findProductByMatchKey(products, "아이폰 15 프로")?.id).toBe("1");
    expect(findProductByMatchKey(products, "macbookpro14m4")?.id).toBe("2");
  });
});

describe("filterProductSuggestions", () => {
  it("returns no rows for empty or whitespace query (no catalog browse)", () => {
    expect(filterProductSuggestions(CATALOG, "")).toEqual([]);
    expect(filterProductSuggestions(CATALOG, "   ")).toEqual([]);
  });

  it("returns only matching products, capped at 5", () => {
    const sony = filterProductSuggestions(CATALOG, "Sony");
    expect(sony.map((p) => p.name)).toEqual([
      "Sony A7 IV",
      "Sony FE 24-70mm F2.8 GM II",
    ]);
    expect(filterProductSuggestions(CATALOG, "Pro", 5).length).toBeLessThanOrEqual(5);
  });

  it("matches Hangul aliases without requiring an exact catalog pick", () => {
    expect(filterProductSuggestions(CATALOG, "아이폰").map((p) => p.id)).toEqual([
      "1",
    ]);
  });
});
