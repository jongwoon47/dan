import { getSupabaseEnv } from "@/data/mode";
import { getSupabase } from "@/data/supabase/client";
import { safeReturnPath } from "@/lib/createDraft";

export type SocialProvider = "kakao" | "google";

/** Public Auth settings contain provider availability, never client secrets. */
export async function availableSocialProviders(signal?: AbortSignal): Promise<SocialProvider[]> {
  const { url, anonKey } = getSupabaseEnv();
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: anonKey }, signal,
  });
  if (!response.ok) throw new Error("Auth settings unavailable");
  const settings = await response.json() as { external?: Record<string, boolean> };
  return (["kakao", "google"] as const).filter((provider) => settings.external?.[provider] === true);
}

export function socialReturnUrl(next: string, origin = window.location.origin): string {
  const url = new URL(`${import.meta.env.BASE_URL}login`, origin);
  const safe = safeReturnPath(next);
  // URL normalization also rejects backslash-based cross-origin paths.
  const target = new URL(safe, origin);
  url.searchParams.set("next", target.origin === origin ? `${target.pathname}${target.search}` : "/my");
  return url.toString();
}

export async function startSocialLogin(provider: SocialProvider, next: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider, options: { redirectTo: socialReturnUrl(next) },
  });
  if (error) throw error;
}
