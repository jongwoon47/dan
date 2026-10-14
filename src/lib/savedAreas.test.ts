import { beforeEach, describe, expect, it } from "vitest";
import { addSavedArea, parseSavedAreas, removeSavedArea, updateSavedArea } from "./savedAreas";

beforeEach(() => { localStorage.clear(); });

describe("saved activity areas", () => {
  it("saves at most three region labels and removes one", () => {
    expect(addSavedArea({ country: "JP", label: "博多区" })).toBe("saved");
    expect(addSavedArea({ country: "JP", label: "博多区" })).toBe("exists");
    expect(addSavedArea({ country: "KR", label: "성동구" })).toBe("saved");
    expect(addSavedArea({ country: "JP", label: "熊本市" })).toBe("saved");
    expect(addSavedArea({ country: "KR", label: "강남구" })).toBe("full");
    removeSavedArea({ country: "JP", label: "博多区" });
    expect(addSavedArea({ country: "KR", label: "강남구" })).toBe("saved");
  });

  it("rejects invalid and duplicate values from untrusted local storage", () => {
    expect(addSavedArea({ country: "KR", label: "" })).toBe("invalid");
    expect(parseSavedAreas("not json")).toEqual([]);
    expect(parseSavedAreas(JSON.stringify([
      { label: "博多区", country: "JP" },
      { label: "博多区", country: "JP" },
      { label: "하카타", country: "INVALID" },
    ]))).toEqual([{ label: "博多区", country: "JP" }]);
  });

  it("refuses precise residential addresses, GPS coords and postcodes", () => {
    expect(addSavedArea({ country: "JP", label: "〒812-0012 福岡市" })).toBe("invalid");
    expect(addSavedArea({ country: "KR", label: "역삼동 123-45" })).toBe("invalid");
    expect(addSavedArea({ country: "JP", label: "33.59, 130.42" })).toBe("invalid");
    expect(addSavedArea({ country: "JP", label: "博多区" })).toBe("saved");
  });
  
  it("never persists coordinates as saved areas", () => {
    addSavedArea({ country: "KR", label: "성동구" });
    const stored = localStorage.getItem("dan-saved-areas-v1") ?? "";
    expect(stored).not.toContain("lat");
    expect(stored).not.toContain("lng");
  });

  it("edits a saved area in place without exceeding the max", () => {
    expect(addSavedArea({ country: "JP", label: "博多区" })).toBe("saved");
    expect(addSavedArea({ country: "KR", label: "성동구" })).toBe("saved");
    expect(updateSavedArea(
      { country: "JP", label: "博多区" },
      { country: "JP", label: "中央区" },
    )).toBe("saved");
    expect(parseSavedAreas(localStorage.getItem("dan-saved-areas-v1") ?? "[]")).toEqual([
      { label: "中央区", country: "JP" },
      { label: "성동구", country: "KR" },
    ]);
    expect(updateSavedArea(
      { country: "JP", label: "中央区" },
      { country: "KR", label: "성동구" },
    )).toBe("exists");
    expect(updateSavedArea(
      { country: "JP", label: "없는지역" },
      { country: "JP", label: "天神" },
    )).toBe("missing");
  });
});
