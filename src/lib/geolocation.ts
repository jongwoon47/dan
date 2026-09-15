import type { Place } from "@/domain/fulfillment";
import { placeFromLabel } from "@/domain/fulfillment";
import { saveViewerGeo } from "@/lib/geoDistance";

export type GeoLocateResult =
  | { ok: true; place: Place }
  | { ok: false; reason: "unsupported" | "denied" | "unavailable" | "timeout" };

function mapGeoError(
  err: GeolocationPositionError,
): "denied" | "unavailable" | "timeout" {
  if (err.code === err.PERMISSION_DENIED) return "denied";
  if (err.code === err.TIMEOUT) return "timeout";
  return "unavailable";
}

/** Reverse-geocode to an approximate public label — never expose raw coords in UI. */
async function approximateLabel(lat: number, lng: number): Promise<{
  publicLabel: string;
  region1?: string;
  region2?: string;
}> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("reverse failed");
    const data = (await res.json()) as {
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const region2 =
      a.city || a.town || a.county || a.borough || a.municipality || undefined;
    const region1 = a.state || a.province || undefined;
    const publicLabel = [region2, region1].filter(Boolean).join(" · ") || "내 주변";
    return { publicLabel, region1, region2 };
  } catch {
    return { publicLabel: "내 주변" };
  }
}

export function requestCurrentPlace(
  placeNote?: string,
): Promise<GeoLocateResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        void (async () => {
          const approx = await approximateLabel(lat, lng);
          const note = placeNote?.trim();
          const publicLabel = note
            ? `${approx.region2 ?? approx.publicLabel} · ${note}`
            : approx.publicLabel;
          resolve({
            ok: true,
            place: {
              ...placeFromLabel(publicLabel, {
                region1: approx.region1,
                region2: approx.region2,
              }),
              geo: { lat, lng },
            },
          });
          saveViewerGeo(lat, lng);
        })();
      },
      (err) => resolve({ ok: false, reason: mapGeoError(err) }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  });
}
