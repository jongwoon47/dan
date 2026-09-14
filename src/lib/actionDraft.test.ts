import { describe, expect, it, beforeEach } from "vitest";
import {
  clearOwnDraft,
  clearResponseDraft,
  loadOwnDraft,
  loadResponseDraft,
  saveOwnDraft,
  saveResponseDraft,
} from "@/lib/actionDraft";

describe("actionDraft", () => {
  beforeEach(() => {
    clearOwnDraft();
    clearResponseDraft();
  });

  it("restores ownership condition for the same product only", () => {
    saveOwnDraft({ productId: "p1", condition: "sealed" });
    expect(loadOwnDraft("p1")).toBe("sealed");
    expect(loadOwnDraft("p2")).toBeNull();
  });

  it("restores response composer fields for the same demand", () => {
    saveResponseDraft({
      demandId: "d1",
      offerPrice: "12000",
      availability: "오늘 저녁",
      message: "가능합니다",
    });
    expect(loadResponseDraft("d1")).toEqual({
      demandId: "d1",
      offerPrice: "12000",
      availability: "오늘 저녁",
      message: "가능합니다",
    });
    expect(loadResponseDraft("d2")).toBeNull();
  });
});
