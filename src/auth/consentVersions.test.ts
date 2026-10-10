import { describe, expect, it } from "vitest";
import { isConsentSatisfied, legalDocumentHref } from "./consentVersions";

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

describe("legalDocumentHref", () => {
  it("routes JA locale to /ja/ drafts including support", () => {
    expect(legalDocumentHref("terms", "ko")).toContain("/terms/");
    expect(legalDocumentHref("privacy", "ko")).toContain("/privacy/");
    expect(legalDocumentHref("support", "ko")).toContain("/support/");
    expect(legalDocumentHref("terms", "ja")).toContain("/ja/terms/");
    expect(legalDocumentHref("privacy", "ja")).toContain("/ja/privacy/");
    expect(legalDocumentHref("support", "ja")).toContain("/ja/support/");
  });
});
