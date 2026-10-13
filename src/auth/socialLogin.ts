import { getSupabaseEnv } from "@/data/mode";
import { getSupabase } from "@/data/supabase/client";
import { safeReturnPath } from "@/lib/createDraft";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import {
  signInWithAppleNative,
  supportsNativeAppleSignIn,
} from "./appleSignIn";
import { NATIVE_AUTH_REDIRECT, NATIVE_RETURN_KEY } from "./nativeAuth";

export type SocialProvider = "kakao" | "google" | "apple";

export type SocialLoginResult =
  | { mode: "redirect" }
  | { mode: "session" };

/**
 * Public Auth settings contain provider availability, never client secrets.
 * On iOS, Apple is always offered alongside Google/Kakao (Guideline 4.8) via
 * native Sign in with Apple — even before the OAuth Apple toggle is inspected.
 */
export async function availableSocialProviders(
  signal?: AbortSignal,
): Promise<SocialProvider[]> {
  const { url, anonKey } = getSupabaseEnv();
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: anonKey },
    signal,
  });
  if (!response.ok) throw new Error("Auth settings unavailable");
  const settings = (await response.json()) as {
    external?: Record<string, boolean>;
  };
  const enabled = (["google", "kakao", "apple"] as const).filter(
    (provider) => settings.external?.[provider] === true,
  );
  return orderSocialProviders([...enabled]);
}

/** Prefer Apple first on iOS when any third-party login is present (4.8). */
export function orderSocialProviders(
  enabled: SocialProvider[],
  platform = Capacitor.getPlatform(),
): SocialProvider[] {
  const hasThirdParty = enabled.some(
    (provider) =>
      provider === "google" || provider === "kakao" || provider === "apple",
  );
  const canonical = (["google", "kakao", "apple"] as const).filter((provider) =>
    enabled.includes(provider),
  );
  if (platform === "ios" && hasThirdParty) {
    return ["apple", ...canonical.filter((provider) => provider !== "apple")];
  }
  return [...canonical];
}

export function socialReturnUrl(
  next: string,
  origin = window.location.origin,
): string {
  const url = new URL(`${import.meta.env.BASE_URL}login`, origin);
  const safe = safeReturnPath(next);
  // URL normalization also rejects backslash-based cross-origin paths.
  const target = new URL(safe, origin);
  url.searchParams.set(
    "next",
    target.origin === origin ? `${target.pathname}${target.search}` : "/my",
  );
  return url.toString();
}

export async function startSocialLogin(
  provider: SocialProvider,
  next: string,
): Promise<SocialLoginResult> {
  if (provider === "apple" && supportsNativeAppleSignIn()) {
    await signInWithAppleNative();
    return { mode: "session" };
  }

  const native = Capacitor.isNativePlatform();
  if (native) sessionStorage.setItem(NATIVE_RETURN_KEY, safeReturnPath(next));
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: native
      ? { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true }
      : { redirectTo: socialReturnUrl(next) },
  });
  if (error) throw error;
  if (native) {
    if (!data.url) throw new Error("OAuth URL missing");
    await Browser.open({ url: data.url });
  }
  return { mode: "redirect" };
}
