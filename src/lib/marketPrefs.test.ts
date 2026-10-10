import { afterEach, describe, expect, it } from "vitest";
import {
  parseMarketCountry,
  readStoredMarketCountry,
  resolveMarketCountry,
  writeStoredMarketCountry,
} from "./marketPrefs";

describe("marketPrefs", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("parses only KR/JP", () => {
    expect(parseMarketCountry("JP")).toBe("JP");
    expect(parseMarketCountry("KR")).toBe("KR");
    expect(parseMarketCountry("US")).toBeNull();
    expect(parseMarketCountry("ja")).toBeNull();
  });

  it("defaults stored market to KR and never follows language", () => {
    expect(readStoredMarketCountry()).toBe("KR");
    writeStoredMarketCountry("JP");
    expect(readStoredMarketCountry()).toBe("JP");
  });

  it("prefers URL market over stored preference", () => {
    writeStoredMarketCountry("JP");
    expect(resolveMarketCountry("KR")).toBe("KR");
    expect(resolveMarketCountry(null)).toBe("JP");
  });
});
