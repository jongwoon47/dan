import { beforeEach, describe, expect, it } from "vitest";
import { getLocale, setDanLocale, translate } from "./locale";

beforeEach(() => { localStorage.clear(); });

describe("DAN Korean/Japanese pilot locale", () => {
  it("defaults to Korean unless the device or saved setting requests Japanese", () => {
    expect(getLocale()).toBe("ko");
    setDanLocale("ja");
    expect(getLocale()).toBe("ja");
    expect(document.documentElement.lang).toBe("ja");
    setDanLocale("ko");
    expect(getLocale()).toBe("ko");
  });

  it("translates common user paths and interpolates radius", () => {
    expect(translate("ja", "explore")).toBe("探す");
    expect(translate("ja", "task")).toBe("おつかい");
    expect(translate("ja", "aroundKm", { km: 3 })).toBe("約3km以内");
    expect(translate("ko", "aroundKm", { km: 5 })).toBe("약 5km 이내");
  });

  it("explicitly keeps KRW, not fabricated JPY conversion", () => {
    expect(translate("ja", "wonNotice")).toContain("KRW");
    expect(translate("ja", "wonNotice")).toContain("円決済には未対応");
  });
});
