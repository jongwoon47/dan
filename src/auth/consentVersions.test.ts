import { describe, expect, it } from "vitest";
import { isConsentSatisfied } from "./consentVersions";

describe("isConsentSatisfied", () => {
  it("requires both current versions", () => {
    expect(isConsentSatisfied(null)).toBe(false);
    expect(
      isConsentSatisfied(
        { termsVersion: "2026-10-07", privacyVersion: "2026-10-07" },
        "2026-10-07",
        "2026-10-07",
      ),
    ).toBe(true);
    expect(
      isConsentSatisfied(
        { termsVersion: "2026-01-01", privacyVersion: "2026-10-07" },
        "2026-10-07",
        "2026-10-07",
      ),
    ).toBe(false);
    expect(
      isConsentSatisfied(
        { termsVersion: "2026-10-07", privacyVersion: "old" },
        "2026-10-07",
        "2026-10-07",
      ),
    ).toBe(false);
  });
});
