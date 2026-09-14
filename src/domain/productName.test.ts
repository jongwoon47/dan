import { describe, expect, it } from "vitest";
import {
  findProductByMatchKey,
  productMatchKey,
} from "@/domain/productName";

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
