import { safeReturnPath } from "@/lib/createDraft";

/** Build a post-login return URL that preserves the current protected action context. */
export function loginUrl(next?: string | null): string {
  const fallback =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/my";
  const path = safeReturnPath(next || fallback, "/my");
  return `/login?next=${encodeURIComponent(path)}`;
}

export function assignLogin(next?: string | null): void {
  window.location.assign(loginUrl(next));
}
