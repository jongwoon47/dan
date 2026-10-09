import { afterEach, expect, it, vi } from "vitest";
import { availableSocialProviders, socialReturnUrl, startSocialLogin } from "./socialLogin";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { NATIVE_AUTH_REDIRECT } from "./nativeAuth";

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("@/data/supabase/client", () => ({ getSupabase: () => ({ auth: { signInWithOAuth } }) }));
vi.mock("@/data/mode", () => ({ getSupabaseEnv: () => ({ url: "https://staging.example", anonKey: "public-test-key" }) }));
vi.mock("@capacitor/browser", () => ({ Browser: { open: vi.fn() } }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.restoreAllMocks(); });

it("preserves protected action and refuses cross-origin returns", () => {
  expect(new URL(socialReturnUrl("/create?type=TASK", "https://dan.example")).searchParams.get("next")).toBe("/create?type=TASK");
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example"]) {
    expect(new URL(socialReturnUrl(next, "https://dan.example")).searchParams.get("next")).toBe("/my");
  }
});

it("only offers providers explicitly enabled by Auth", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ external: { google: true, kakao: false } }) }));
  expect(await availableSocialProviders()).toEqual(["google"]);
});

it("surfaces provider errors rather than treating them as successful login", async () => {
  const error = new Error("provider disabled");
  signInWithOAuth.mockResolvedValue({ error });
  await expect(startSocialLogin("kakao", "/my")).rejects.toBe(error);
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "kakao", options: { redirectTo: expect.stringContaining("/login?next=") } });
});

it("opens native OAuth outside WKWebView and uses the registered staging callback", async () => {
  vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
  const open = vi.mocked(Browser.open).mockResolvedValue();
  signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/authorize" }, error: null });
  await startSocialLogin("google", "/create?type=TASK");
  expect(signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true } });
  expect(open).toHaveBeenCalledWith({ url: "https://accounts.google.com/authorize" });
});
