import { describe, expect, it } from "vitest";
import { consentReturnPath } from "./ConsentProvider";

describe("consentReturnPath", () => {
  it("blocks consent/login loops and unsafe paths", () => {
    expect(consentReturnPath("/my")).toBe("/my");
    expect(consentReturnPath("/create?type=BUY")).toBe("/create?type=BUY");
    expect(consentReturnPath("/consent")).toBe("/");
    expect(consentReturnPath("/consent?next=%2Fmy")).toBe("/");
    expect(consentReturnPath("/login")).toBe("/");
    expect(consentReturnPath("//evil")).toBe("/");
    expect(consentReturnPath(null)).toBe("/");
  });
});
