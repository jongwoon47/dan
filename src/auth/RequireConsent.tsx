import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useDanCopy } from "@/copy/useDanCopy";
import { useAuth } from "./AuthProvider";
import { consentReturnPath, useConsent } from "./ConsentProvider";

/** Blocks authenticated app chrome until current consent versions are saved. */
export function RequireConsent() {
  const copy = useDanCopy();
  const { mode, status } = useAuth();
  const { resolution } = useConsent();
  const location = useLocation();

  if (mode === "demo") return <Outlet />;

  if (
    status === "loading" ||
    (status === "authenticated" && resolution === "loading")
  ) {
    return (
      <div className="auth-screen auth-screen--resolving" role="status" aria-busy="true">
        <span className="sr-only">{copy.loadingScreen}</span>
      </div>
    );
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
