import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("expires stale drafts instead of resurrecting them", () => {
    saveOwnDraft({ productId: "p1", condition: "like_new" });
    saveResponseDraft({
      demandId: "d1",
      offerPrice: "",
      availability: "",
      message: "남김",
    });
    vi.setSystemTime(new Date("2026-09-15T03:00:01Z"));
    expect(loadOwnDraft("p1")).toBeNull();
    expect(loadResponseDraft("d1")).toBeNull();
  });
});
