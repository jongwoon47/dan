import { afterEach, expect, it, vi } from "vitest";
import {
  availableSocialProviders,
  orderSocialProviders,
  socialReturnUrl,
  startSocialLogin,
} from "./socialLogin";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { NATIVE_AUTH_REDIRECT } from "./nativeAuth";

const { signInWithOAuth, signInWithAppleNative } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithAppleNative: vi.fn(),
}));
vi.mock("@/data/supabase/client", () => ({
  getSupabase: () => ({ auth: { signInWithOAuth } }),
}));
vi.mock("@/data/mode", () => ({
  getSupabaseEnv: () => ({
    url: "https://staging.example",
    anonKey: "public-test-key",
  }),
}));
vi.mock("@capacitor/browser", () => ({ Browser: { open: vi.fn() } }));
vi.mock("./appleSignIn", async () => {
  const actual = await vi.importActual<typeof import("./appleSignIn")>(
    "./appleSignIn",
  );
  return {
    ...actual,
    signInWithAppleNative,
    supportsNativeAppleSignIn: () => Capacitor.getPlatform() === "ios",
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("preserves protected action and refuses cross-origin returns", () => {
  expect(
    new URL(
      socialReturnUrl("/create?type=TASK", "https://dan.example"),
    ).searchParams.get("next"),
  ).toBe("/create?type=TASK");
  for (const next of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
  ]) {
    expect(
      new URL(socialReturnUrl(next, "https://dan.example")).searchParams.get(
        "next",
      ),
    ).toBe("/my");
  }
});

it("only offers providers explicitly enabled by Auth on web", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ external: { google: true, kakao: false, apple: false } }),
    }),
  );
  expect(await availableSocialProviders()).toEqual(["google"]);
});

it("puts Apple first on iOS when Google is enabled (Guideline 4.8)", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        external: { google: true, kakao: true, apple: false },
      }),
    }),
  );
  expect(await availableSocialProviders()).toEqual([
    "apple",
    "google",
    "kakao",
  ]);
  expect(orderSocialProviders(["google"], "ios")).toEqual(["apple", "google"]);
});

it("surfaces provider errors rather than treating them as successful login", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("web");
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
  const error = new Error("provider disabled");
  signInWithOAuth.mockResolvedValue({ error });
  await expect(startSocialLogin("kakao", "/my")).rejects.toBe(error);
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: "kakao",
    options: { redirectTo: expect.stringContaining("/login?next=") },
  });
});

it("opens native OAuth outside WKWebView and uses the registered callback", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  const open = vi.mocked(Browser.open).mockResolvedValue();
  signInWithOAuth.mockResolvedValue({
    data: { url: "https://accounts.google.com/authorize" },
    error: null,
  });
  await expect(startSocialLogin("google", "/create?type=TASK")).resolves.toEqual(
    { mode: "redirect" },
  );
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: "google",
    options: {
      redirectTo: NATIVE_AUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });
  expect(open).toHaveBeenCalledWith({
    url: "https://accounts.google.com/authorize",
  });
});

it("uses native Sign in with Apple on iOS instead of OAuth redirect", async () => {
  vi.spyOn(Capacitor, "getPlatform").mockReturnValue("ios");
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  signInWithAppleNative.mockResolvedValue(undefined);
  await expect(startSocialLogin("apple", "/my")).resolves.toEqual({
    mode: "session",
  });
  expect(signInWithAppleNative).toHaveBeenCalledOnce();
  expect(signInWithOAuth).not.toHaveBeenCalled();
});
