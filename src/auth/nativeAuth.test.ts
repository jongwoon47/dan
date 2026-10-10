import { expect, it } from "vitest";
import { nativeAuthScheme, parseNativeAuthUrl } from "./nativeAuth";

it("uses a separate native callback scheme for staging and production", () => {
  expect(nativeAuthScheme("staging")).toBe("dan-staging");
  expect(nativeAuthScheme("production")).toBe("dan");
});

it("only consumes the exact configured callback and never accepts tokens from arbitrary links", () => {
  expect(parseNativeAuthUrl("dan-staging://auth/callback?code=one-use-code", "dan-staging")).toEqual({
    code: "one-use-code",
    failed: false,
  });
  expect(parseNativeAuthUrl("dan://auth/callback?error=access_denied", "dan")).toEqual({
    code: null,
    failed: true,
  });
  for (const raw of [
    "https://evil.example/callback?code=x",
    "dan-staging://other/callback?code=x",
    "dan-staging://auth/other?code=x",
    "dan://auth/callback?code=x",
    "invalid",
  ]) {
    expect(parseNativeAuthUrl(raw, "dan-staging")).toBeNull();
  }
});
