import { useSyncExternalStore } from "react";
import { useDanCopy } from "@/copy/useDanCopy";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function NetworkStatusBanner() {
  const copy = useDanCopy();
  const online = useSyncExternalStore(subscribe, getSnapshot, () => true);
  if (online) return null;

  return (
    <div className="network-status-banner" role="status" aria-live="polite">
      <span aria-hidden />
      {copy.networkOffline}
    </div>
  );
}
