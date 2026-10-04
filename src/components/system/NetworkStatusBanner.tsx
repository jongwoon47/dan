import { useSyncExternalStore } from "react";

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
  const online = useSyncExternalStore(subscribe, getSnapshot, () => true);
  if (online) return null;

  return (
    <div className="network-status-banner" role="status" aria-live="polite">
      <span aria-hidden />
      오프라인이에요. 연결이 돌아오면 DAN이 자동으로 다시 동기화합니다.
    </div>
  );
}
