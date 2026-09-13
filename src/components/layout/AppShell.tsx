import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import "./layout.css";

export function AppShell() {
  const { currentUser, isLoggedIn, login, logout } = useDan();
  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="top-nav__inner">
          <NavLink to="/" className="brand" aria-label="DAN home">
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
          <nav className="top-nav__links" aria-label="primary">
            <NavLink to="/create">{ko.navCreate}</NavLink>
            <NavLink to="/feed">{ko.navFeed}</NavLink>
            <NavLink to="/my">{ko.navMy}</NavLink>
          </nav>
          <div className="top-nav__auth">
            {isLoggedIn && currentUser ? (
              <>
                <span className="top-nav__user">{currentUser.name}</span>
                <Button size="sm" variant="secondary" onClick={logout}>{ko.logout}</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => login()}>{ko.login}</Button>
            )}
          </div>
        </div>
      </header>
      <main className="app-main"><Outlet /></main>
      <nav className="bottom-nav" aria-label="mobile">
        <NavLink to="/" end><span>{ko.navHome}</span></NavLink>
        <NavLink to="/feed"><span>{ko.navDemand}</span></NavLink>
        <NavLink to="/my"><span>{ko.navMy}</span></NavLink>
      </nav>
    </div>
  );
}
