import type { Place } from "@/domain/fulfillment";

const VIEWER_GEO_KEY = "dan-viewer-geo-v1";

export type ViewerGeo = { lat: number; lng: number; savedAt: number };

export function saveViewerGeo(lat: number, lng: number): void {
  try {
    const payload: ViewerGeo = { lat, lng, savedAt: Date.now() };
    sessionStorage.setItem(VIEWER_GEO_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function loadViewerGeo(maxAgeMs = 6 * 3600_000): ViewerGeo | null {
  try {
    const raw = sessionStorage.getItem(VIEWER_GEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ViewerGeo;
    if (
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.lng)
    ) {
      return null;
    }
    if (Date.now() - (parsed.savedAt || 0) > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Haversine distance in meters. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Consumer distance label — never exact coordinates. */
export function formatApproxDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000) {
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    return `약 ${rounded}m`;
  }
  const km = meters / 1000;
  const rounded = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return `약 ${rounded}km`;
}

/**
 * Public place line before CONNECTED.
 * Prefer server approx meters; never render coordinates.
 * Text-entered → publicLabel as-is (already approximate).
 */
export function formatPublicPlaceLine(
  place: Place,
  viewer?: { lat: number; lng: number } | null,
  opts?: { revealDetail?: boolean; approxMeters?: number | null },
): string {
  if (opts?.revealDetail) return place.publicLabel.trim();

  if (opts?.approxMeters != null && Number.isFinite(opts.approxMeters)) {
    return formatApproxDistance(opts.approxMeters);
  }

  // Legacy client-side path (should not receive geo after privacy scrub).
  if (place.geo && viewer) {
    const meters = distanceMeters(viewer, place.geo);
    return formatApproxDistance(meters);
  }
  if (place.geo) {
    return (place.region2 || place.region1 || "내 주변").trim();
  }
  return place.publicLabel.trim();
}
