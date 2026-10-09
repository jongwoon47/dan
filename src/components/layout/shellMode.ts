/** ROOT keeps global chrome; DEEP hides bottom nav; AUTH is standalone. */

import type { LocalizedCopy } from "@/copy/useDanCopy";
import { ko } from "@/copy/ko";
import type { DanLocale } from "@/i18n/locale";

export type ShellMode = "root" | "deep" | "auth";

export function getShellMode(pathname: string): ShellMode {
  if (pathname === "/login" || pathname === "/consent") return "auth";
  if (
    pathname === "/" ||
    pathname === "/feed" ||
    pathname === "/chats" ||
    pathname === "/my"
  ) {
    return "root";
  }
  return "deep";
}

export function deepFallback(pathname: string): string {
  if (pathname.startsWith("/match/")) return "/chats";
  if (pathname.startsWith("/activity")) return "/my";
  if (pathname.startsWith("/profile/")) return "/my";
  if (pathname.startsWith("/create")) return "/";
  if (pathname.startsWith("/buy/new")) return "/";
  if (pathname.startsWith("/deal/")) return "/my";
  if (pathname.startsWith("/demand")) return "/feed";
  if (pathname.startsWith("/ownership")) return "/my";
  return "/";
}

function deepTitleFallback(pathname: string, locale: DanLocale): string {
  const ja = locale === "ja";
  if (pathname.startsWith("/buy/new")) return ja ? "購入リクエスト登録" : "구매수요 등록";
  if (pathname.startsWith("/demand/") && pathname.endsWith("/offer")) {
    return ja ? "かんたん販売提案" : "빠른 판매 제안";
  }
  if (pathname.startsWith("/deal/") && pathname.endsWith("/evidence")) {
    return ja ? "出品者の証拠提出" : "판매자 증거 제출";
  }
  if (pathname.startsWith("/deal/") && pathname.endsWith("/snapshot")) {
    return ja ? "取引条件の確認" : "거래 조건 확인";
  }
  if (pathname.startsWith("/deal/") && pathname.endsWith("/handoff")) {
    return ja ? "受け渡し最終確認" : "직거래 최종 확인";
  }
  if (pathname.includes("/edit")) return ja ? "依頼を編集" : "요청 수정";
  if (pathname.startsWith("/demand/item/") || pathname.startsWith("/demand/")) {
    return ja ? "依頼" : "요청";
  }
  return "";
}

export function defaultDeepTitle(
  pathname: string,
  copy: LocalizedCopy = ko,
  locale: DanLocale = "ko",
): string {
  if (pathname.startsWith("/create")) return copy.createTitle;
  if (pathname.startsWith("/activity")) return copy.navActivity;
  if (pathname.includes("/own")) return copy.ownTitle;
  if (pathname.includes("/sell-intent")) return copy.sellTitle;
  if (pathname.startsWith("/match/")) return copy.chatTitle;
  if (pathname.startsWith("/profile/")) return copy.profileTitle;
  return deepTitleFallback(pathname, locale);
}
