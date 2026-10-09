import { describe, expect, it } from "vitest";
import { isConsentSatisfied } from "./consentVersions";

const current = { termsVersion: "2026-10-07", privacyVersion: "2026-10-07" };

describe("isConsentSatisfied", () => {
  it("requires both current server versions", () => {
    expect(isConsentSatisfied(null, current)).toBe(false);
    expect(
      isConsentSatisfied(
        { termsVersion: "2026-10-07", privacyVersion: "2026-10-07" },
        current,
      ),
    ).toBe(true);
    expect(
      isConsentSatisfied(
        { termsVersion: "2026-01-01", privacyVersion: "2026-10-07" },
        current,
      ),
    ).toBe(false);
    expect(
      isConsentSatisfied(
        { termsVersion: "2026-10-07", privacyVersion: "old" },
        current,
      ),
    ).toBe(false);
  });
});
