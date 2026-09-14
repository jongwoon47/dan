import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { DeepHeader } from "./DeepHeader";
import { ShellChromeProvider, useShellChrome } from "./ShellChrome";
import {
  deepFallback,
  defaultDeepTitle,
  getShellMode,
} from "./shellMode";
import "./layout.css";

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconFeed({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M5 12h14M5 17h9"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMy({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12"
        cy="9"
        r="3.25"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M5.5 19.5c1.4-3 3.7-4.5 6.5-4.5s5.1 1.5 6.5 4.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function AppShellInner() {
  const { currentUser, isLoggedIn, login, logout, unreadActivityCount } = useDan();
  const { pathname } = useLocation();
  const mode = getShellMode(pathname);
  const { header } = useShellChrome();

  const showDeepHeader = mode === "deep" && !header?.hide;
  const deepTitle = header?.title ?? defaultDeepTitle(pathname);
  const deepSubtitle = header?.subtitle;
  const deepRight = header?.right;

  return (
    <div
      className={
        mode === "root"
          ? "app-shell app-shell--root"
          : mode === "deep"
            ? "app-shell app-shell--deep"
            : "app-shell app-shell--auth"
      }
    >
      {mode === "root" ? (
        <header className="top-nav">
          <div className="top-nav__inner">
            <NavLink to="/" className="brand" aria-label="DAN 홈">
              <img
                className="brand__logo"
                src="/dan-logo.png"
                alt=""
                width={36}
                height={36}
              />
              <span className="brand__text">
                <span className="brand__mark">DAN</span>
                <span className="brand__tag">{ko.brandTag}</span>
              </span>
            </NavLink>
            <nav className="top-nav__links" aria-label="주요 메뉴">
              <NavLink to="/feed">{ko.navFeed}</NavLink>
              <NavLink to="/create">{ko.navCreate}</NavLink>
              <NavLink to="/my">{ko.navMy}</NavLink>
            </nav>
            <div className="top-nav__auth">
              {isLoggedIn && currentUser ? (
                <>
                  <NavLink
                    to="/activity"
                    className="top-nav__bell"
                    aria-label={ko.navActivity}
                  >
                    {ko.navActivity}
                    {unreadActivityCount > 0 ? (
                      <span className="nav-badge">{unreadActivityCount}</span>
                    ) : null}
                  </NavLink>
                  <NavLink
                    to={`/profile/${currentUser.id}`}
                    className="top-nav__user"
                  >
                    {currentUser.name}
                  </NavLink>
                  <Button size="sm" variant="secondary" onClick={logout}>
                    {ko.logout}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => login()}>
                  {ko.login}
                </Button>
              )}
            </div>
          </div>
        </header>
      ) : null}

      {showDeepHeader && deepTitle ? (
        <DeepHeader
          title={deepTitle}
          subtitle={deepSubtitle}
          right={deepRight}
          fallbackTo={deepFallback(pathname)}
        />
      ) : null}

      <main className="app-main">
        <Outlet />
      </main>

      {mode === "root" ? (
        <>
          <nav className="bottom-nav" aria-label="하단 메뉴">
            <NavLink to="/" end>
              {({ isActive }) => (
                <>
                  <IconHome active={isActive} />
                  <span>{ko.navHome}</span>
                </>
              )}
            </NavLink>
            <NavLink to="/feed">
              {({ isActive }) => (
                <>
                  <IconFeed active={isActive} />
                  <span>{ko.navDemand}</span>
                </>
              )}
            </NavLink>
            <NavLink to="/my" className="bottom-nav__my">
              {({ isActive }) => (
                <>
                  <span className="bottom-nav__icon-wrap">
                    <IconMy active={isActive} />
                    {unreadActivityCount > 0 ? (
                      <span className="nav-badge nav-badge--float">
                        {unreadActivityCount}
                      </span>
                    ) : null}
                  </span>
                  <span>{ko.navMy}</span>
                </>
              )}
            </NavLink>
          </nav>
          <NavLink
            to="/create"
            className="create-fab"
            aria-label={ko.navCreate}
          >
            <IconPlus />
          </NavLink>
        </>
      ) : null}
    </div>
  );
}

export function AppShell() {
  return (
    <ShellChromeProvider>
      <AppShellInner />
    </ShellChromeProvider>
  );
}
