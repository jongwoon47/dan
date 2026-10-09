import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { consentReturnPath, useConsent } from "./ConsentProvider";

/** Blocks authenticated app chrome until current consent versions are saved. */
export function RequireConsent() {
  const { mode, status } = useAuth();
  const { resolution } = useConsent();
  const location = useLocation();

  if (mode === "demo") return <Outlet />;

  if (
    status === "loading" ||
    (status === "authenticated" && resolution === "loading")
  ) {
    return <div className="auth-screen auth-screen--resolving" aria-busy="true" />;
  }

  if (
    status === "authenticated" &&
    (resolution === "required" || resolution === "error")
  ) {
    const next = consentReturnPath(`${location.pathname}${location.search}`);
    return (
      <Navigate
        to={`/consent?next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  return <Outlet />;
}
