import { Capacitor } from "@capacitor/core";
import { SignInWithApple } from "@capacitor-community/apple-sign-in";
import { getSupabase } from "@/data/supabase/client";

export class AppleSignInCancelledError extends Error {
  readonly code = "USER_CANCELLED";
  constructor() {
    super("Apple sign-in cancelled");
    this.name = "AppleSignInCancelledError";
  }
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Raw nonce for Supabase + SHA-256 hex for Apple's ASAuthorization request. */
export async function createAppleNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = bytesToHex(bytes.buffer);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return { raw, hashed: bytesToHex(digest) };
}

function displayNameFromApple(profile: {
  givenName: string | null;
  familyName: string | null;
  email: string | null;
}): string | null {
  const joined = [profile.givenName, profile.familyName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (joined) return joined.slice(0, 20);
  const emailLocal = profile.email?.split("@")[0]?.trim();
  return emailLocal ? emailLocal.slice(0, 20) : null;
}

function isCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "USER_CANCELLED" ||
    /cancel|canceled|cancelled|1001/i.test(message)
  );
}

/**
 * Native Sign in with Apple on iOS, then exchange the identity token with Supabase.
 * Captures first-login name (Apple only returns it once) into Auth metadata + profile.
 */
export async function signInWithAppleNative(): Promise<void> {
  if (Capacitor.getPlatform() !== "ios") {
    throw new Error("Native Apple sign-in is only available on iOS");
  }

  const { raw, hashed } = await createAppleNonce();

  let authorized: Awaited<ReturnType<typeof SignInWithApple.authorize>>;
  try {
    // clientId/redirectURI are required by the plugin types for web; iOS uses the App ID.
    authorized = await SignInWithApple.authorize({
      clientId: "app.dan.ios",
      redirectURI: "https://dan.pages.dev/login",
      scopes: "email name",
      nonce: hashed,
    });
  } catch (error) {
    if (isCancelled(error)) throw new AppleSignInCancelledError();
    throw error;
  }

  const idToken = authorized.response.identityToken;
  if (!idToken) throw new Error("Apple identity token missing");

  const { error } = await getSupabase().auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
    nonce: raw,
  });
  if (error) throw error;

  const displayName = displayNameFromApple({
    givenName: authorized.response.givenName,
    familyName: authorized.response.familyName,
    email: authorized.response.email,
  });
  if (displayName) {
    try {
      const sb = getSupabase();
      await sb.auth.updateUser({
        data: {
          display_name: displayName,
          full_name: displayName,
          given_name: authorized.response.givenName,
          family_name: authorized.response.familyName,
        },
      });
      // Only patch display_name — never wipe area/bio on re-authorization.
      const { data: auth } = await sb.auth.getUser();
      if (auth.user) {
        await sb
          .from("profiles")
          .update({
            display_name: displayName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", auth.user.id);
      }
    } catch {
      // Name is best-effort; session is already established.
    }
  }
}

export function supportsNativeAppleSignIn(
  platform = Capacitor.getPlatform(),
): boolean {
  return platform === "ios";
}
