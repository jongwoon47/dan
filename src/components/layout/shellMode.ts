/** ROOT keeps global chrome; DEEP hides bottom nav; AUTH is standalone. */

export type ShellMode = "root" | "deep" | "auth";

export function getShellMode(pathname: string): ShellMode {
  if (pathname === "/login") return "auth";
  if (
    pathname === "/" ||
    pathname === "/feed" ||
    pathname === "/my"
  ) {
    return "root";
  }
  return "deep";
}

export function deepFallback(pathname: string): string {
  if (pathname.startsWith("/match/")) return "/my";
  if (pathname.startsWith("/activity")) return "/my";
  if (pathname.startsWith("/profile/")) return "/my";
  if (pathname.startsWith("/create")) return "/";
  if (pathname.startsWith("/demand")) return "/feed";
  if (pathname.startsWith("/ownership")) return "/my";
  return "/";
}

export function defaultDeepTitle(pathname: string): string {
  if (pathname.startsWith("/create")) return "요청 올리기";
  if (pathname.startsWith("/activity")) return "알림";
  if (pathname.includes("/edit")) return "요청 수정";
  if (pathname.includes("/own")) return "내 물건 등록";
  if (pathname.includes("/sell-intent")) return "판매 의향";
  if (pathname.startsWith("/match/")) return "대화";
  if (pathname.startsWith("/profile/")) return "프로필";
  if (pathname.startsWith("/demand/item/")) return "요청";
  if (pathname.startsWith("/demand/")) return "요청";
  return "";
}
