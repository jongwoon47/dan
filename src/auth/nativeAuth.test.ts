import { expect, it } from "vitest";
import { parseNativeAuthUrl } from "./nativeAuth";

it("only consumes the exact staging callback and never accepts tokens from arbitrary links", () => {
  expect(parseNativeAuthUrl("dan-staging://auth/callback?code=one-use-code")).toEqual({ code: "one-use-code", failed: false });
  expect(parseNativeAuthUrl("dan-staging://auth/callback?error=access_denied")).toEqual({ code: null, failed: true });
  for (const raw of ["https://evil.example/callback?code=x", "dan-staging://other/callback?code=x", "dan-staging://auth/other?code=x", "invalid"]) {
    expect(parseNativeAuthUrl(raw)).toBeNull();
  }
});
