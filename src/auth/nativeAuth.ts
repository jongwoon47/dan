export function nativeAuthScheme(runtime?: string): "dan" | "dan-staging" {
  return runtime === "production" ? "dan" : "dan-staging";
}

export const NATIVE_AUTH_SCHEME = nativeAuthScheme(
  import.meta.env.VITE_DAN_ENV as string | undefined,
);
export const NATIVE_AUTH_REDIRECT = `${NATIVE_AUTH_SCHEME}://auth/callback`;
export const NATIVE_AUTH_FINISHED = "dan-native-auth-finished";
export const NATIVE_RETURN_KEY = "dan-native-login-next";

export function parseNativeAuthUrl(
  raw: string,
  scheme = NATIVE_AUTH_SCHEME,
): { code: string | null; failed: boolean } | null {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== `${scheme}:` ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback"
    ) {
      return null;
    }
    return {
      code: url.searchParams.get("code"),
      failed: url.searchParams.has("error"),
    };
  } catch {
    return null;
  }
}
