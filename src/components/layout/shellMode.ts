/** ROOT keeps global chrome; DEEP hides bottom nav; AUTH is standalone. */

import { ko } from "@/copy/ko";

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
  if (pathname.startsWith("/create")) return ko.createTitle;
  if (pathname.startsWith("/activity")) return ko.navActivity;
  if (pathname.includes("/edit")) return "요청 수정";
  if (pathname.includes("/own")) return ko.ownTitle;
  if (pathname.includes("/sell-intent")) return ko.sellTitle;
  if (pathname.startsWith("/match/")) return ko.chatTitle;
  if (pathname.startsWith("/profile/")) return ko.profileTitle;
  if (pathname.startsWith("/demand/item/")) return "요청";
  if (pathname.startsWith("/demand/")) return "요청";
  return "";
}
