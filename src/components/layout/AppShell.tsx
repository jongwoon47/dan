import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { NetworkStatusBanner } from "@/components/system/NetworkStatusBanner";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { DeepHeader } from "./DeepHeader";
import { ShellChromeProvider, useShellChrome } from "./ShellChrome";
import { deepFallback, defaultDeepTitle, getShellMode } from "./shellMode";
import "@/styles/danBlueprint.css";
import "./layout.css";

function IconHome({ active }: { active?: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m4.5 10 7.5-6 7.5 6v9H14v-5h-4v5H4.5v-9Z" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinejoin="round" /></svg>;
}
function IconDemand({ active }: { active?: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="5" y="4.5" width="14" height="15" rx="2.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} /><path d="m8.5 10 1.5 1.5 2.5-3M8.5 15h7" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconPlus() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>;
}
function IconChat({ active }: { active?: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H11l-4.2 3.2c-.7.5-1.8 0-1.8-.9V6.5Z" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinejoin="round" /></svg>;
}
function IconSearch() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="1.9" /><path d="m15 15 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}
function IconBell({ active }: { active?: boolean }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 3.2.9 4.6 1.6 5.5H4.9c.7-.9 1.6-2.3 1.6-5.5Z" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinejoin="round" /><path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" /></svg>;
}
function formatUnreadBadge(count: number): string { if (count <= 0) return ""; if (count > 9) return "9+"; return String(count); }

function AppShellInner() {
  const { currentUser, isLoggedIn, login, logout, unreadActivityCount, unreadChatCount, unreadMyDanCount } = useDan();
  const { pathname } = useLocation();
  const mode = getShellMode(pathname);
  const { header } = useShellChrome();
  const bellBadge = formatUnreadBadge(unreadActivityCount);
  const chatBadge = formatUnreadBadge(unreadChatCount);
  const myBadge = formatUnreadBadge(unreadMyDanCount);
  const showDeepHeader = mode === "deep" && !header?.hide;
  const deepTitle = header?.title ?? defaultDeepTitle(pathname);

  return (
    <div className={mode === "root" ? "app-shell app-shell--root" : mode === "deep" ? "app-shell app-shell--deep" : "app-shell app-shell--auth"}>
      {mode === "root" ? (
        <header className="top-nav">
          <div className="top-nav__inner">
            <NavLink to="/" className="brand" aria-label="DAN 홈">
              <img className="brand__logo" src={`${import.meta.env.BASE_URL}dan-logo.png`} alt="" width={36} height={36} />
              <span className="brand__text"><span className="brand__mark">DAN</span><span className="brand__tag">{ko.brandTag}</span></span>
            </NavLink>
            <div className="top-nav__mobile-actions">
              <NavLink to="/feed" className="top-nav__mobile-search" aria-label="구매수요 탐색"><IconSearch /></NavLink>
              {isLoggedIn ? (
                <NavLink to="/activity" className="top-nav__mobile-bell" aria-label={unreadActivityCount > 0 ? `${ko.navActivity} ${unreadActivityCount}` : ko.navActivity}>
                  {({ isActive }) => <span className="top-nav__bell-wrap"><IconBell active={isActive} />{bellBadge ? <span className="nav-badge nav-badge--float">{bellBadge}</span> : null}</span>}
                </NavLink>
              ) : null}
            </div>
            <nav className="top-nav__links" aria-label="주요 메뉴">
              <NavLink to="/feed">탐색</NavLink><NavLink to="/create">요청</NavLink><NavLink to="/chats">채팅</NavLink><NavLink to="/my">내 거래</NavLink>
            </nav>
            <div className="top-nav__auth top-nav__auth--desktop">
              {isLoggedIn && currentUser ? (
                <>
                  <NavLink to="/activity" className="top-nav__bell" aria-label={unreadActivityCount > 0 ? `${ko.navActivity} ${unreadActivityCount}` : ko.navActivity}>
                    {({ isActive }) => <span className="top-nav__bell-wrap"><IconBell active={isActive} />{bellBadge ? <span className="nav-badge nav-badge--float">{bellBadge}</span> : null}</span>}
                  </NavLink>
                  <NavLink to={`/profile/${currentUser.id}`} className="top-nav__user">{currentUser.name}</NavLink>
                  <Button size="sm" variant="secondary" onClick={logout}>{ko.logout}</Button>
                </>
              ) : <Button size="sm" onClick={() => login()}>{ko.login}</Button>}
            </div>
          </div>
        </header>
      ) : null}

      {showDeepHeader && deepTitle ? <DeepHeader title={deepTitle} subtitle={header?.subtitle} right={header?.right} fallbackTo={deepFallback(pathname)} onBack={header?.onBack} /> : null}

      <NetworkStatusBanner />

      <main className="app-main"><Outlet /></main>

      {mode === "root" ? (
        <nav className="bottom-nav bottom-nav--v1" aria-label="하단 메뉴">
          <NavLink to="/" end>{({ isActive }) => <><IconHome active={isActive} /><span>홈</span></>}</NavLink>
          <NavLink to="/feed">{({ isActive }) => <><IconSearch /><span>탐색</span></>}</NavLink>
          <NavLink to="/create" className="bottom-nav__create" aria-label="요청 등록"><span className="bottom-nav__create-circle"><IconPlus /></span><span>요청</span></NavLink>
          <NavLink to="/chats">{({ isActive }) => <><span className="bottom-nav__icon-wrap"><IconChat active={isActive} />{chatBadge ? <span className="nav-badge nav-badge--float">{chatBadge}</span> : null}</span><span>채팅</span></>}</NavLink>
          <NavLink to="/my">{({ isActive }) => <><span className="bottom-nav__icon-wrap"><IconDemand active={isActive} />{myBadge ? <span className="nav-badge nav-badge--float">{myBadge}</span> : null}</span><span>내 거래</span></>}</NavLink>
        </nav>
      ) : null}
    </div>
  );
}

export function AppShell() {
  return <ShellChromeProvider><AppShellInner /></ShellChromeProvider>;
}
