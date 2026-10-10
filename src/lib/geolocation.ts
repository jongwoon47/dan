import type { Place } from "@/domain/fulfillment";
import { placeFromLabel } from "@/domain/fulfillment";
import { saveViewerGeo } from "@/lib/geoDistance";
import type { FormatLanguage } from "@/lib/format";

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

/** Coarse fallback label when reverse-geocode fails. Locale-only; never invents a city. */
export function nearbyFallbackLabel(language: FormatLanguage = "ko"): string {
  return language === "ja" ? "近く" : "내 주변";
}

/** Reverse-geocode to an approximate public label — never expose raw coords in UI. */
async function approximateLabel(
  lat: number,
  lng: number,
  language: FormatLanguage,
): Promise<{
  publicLabel: string;
  region1?: string;
  region2?: string;
}> {
  const fallback = nearbyFallbackLabel(language);
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": language === "ja" ? "ja" : "ko",
      },
    });
    if (!res.ok) throw new Error("reverse failed");
    const data = (await res.json()) as {
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    const region2 =
      a.city || a.town || a.county || a.borough || a.municipality || undefined;
    const region1 = a.state || a.province || undefined;
    const publicLabel = [region2, region1].filter(Boolean).join(" · ") || fallback;
    return { publicLabel, region1, region2 };
  } catch {
    return { publicLabel: fallback };
  }
}

export function requestCurrentPlace(
  placeNote?: string,
  language: FormatLanguage = "ko",
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
          const approx = await approximateLabel(lat, lng, language);
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
