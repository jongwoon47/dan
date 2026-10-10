import { saveViewerGeo, type ViewerGeo } from "./geoDistance";

export type ViewerLocationResult =
  | { ok: true; viewer: ViewerGeo }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "timeout" };

/** Single foreground fix, only when explicitly requested. No Nominatim request. */
export function requestViewerGeo(): Promise<ViewerLocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
          resolve({ ok: false, reason: "unavailable" });
          return;
        }
        saveViewerGeo(coords.latitude, coords.longitude);
        resolve({
          ok: true,
          viewer: { lat: coords.latitude, lng: coords.longitude, savedAt: Date.now() },
        });
      },
      (error) => {
        const reason = error.code === error.PERMISSION_DENIED
          ? "denied"
          : error.code === error.TIMEOUT
            ? "timeout"
            : "unavailable";
        resolve({ ok: false, reason });
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  });
}
