import { afterEach, describe, expect, it } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import {
  parseMarketCountry,
  readStoredMarketCountry,
  resolveMarketCountry,
  writeStoredMarketCountry,
} from "./marketPrefs";

describe("marketPrefs", () => {
  afterEach(() => {
    localStorage.clear();
    setDanLocale("ko");
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

  it("does not infer JP market from Japanese UI locale alone", () => {
    setDanLocale("ja");
    expect(readStoredMarketCountry()).toBe("KR");
    expect(resolveMarketCountry(null)).toBe("KR");
    expect(resolveMarketCountry("ja")).toBe("KR");
    expect(parseMarketCountry(navigator.language)).toBeNull();
  });
});
