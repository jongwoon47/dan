export const NATIVE_AUTH_REDIRECT = "dan-staging://auth/callback";
export const NATIVE_AUTH_FINISHED = "dan-native-auth-finished";
export const NATIVE_RETURN_KEY = "dan-native-login-next";

export function parseNativeAuthUrl(raw: string): { code: string | null; failed: boolean } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "dan-staging:" || url.hostname !== "auth" || url.pathname !== "/callback") return null;
    return { code: url.searchParams.get("code"), failed: url.searchParams.has("error") };
  } catch { return null; }
}
