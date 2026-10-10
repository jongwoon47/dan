import { afterEach, describe, expect, it, vi } from "vitest";
import { nearbyFallbackLabel, requestCurrentPlace } from "./geolocation";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("nearbyFallbackLabel", () => {
  it("keeps coarse locale-only fallbacks without inventing cities", () => {
    expect(nearbyFallbackLabel("ko")).toBe("내 주변");
    expect(nearbyFallbackLabel("ja")).toBe("近く");
  });
});

describe("requestCurrentPlace", () => {
  it("maps permission denial without calling reverse-geocode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (
          _ok: PositionCallback,
          err: PositionErrorCallback,
        ) => {
          err({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: "denied",
          } as GeolocationPositionError);
        },
      },
    });

    await expect(requestCurrentPlace(undefined, "ja")).resolves.toEqual({
      ok: false,
      reason: "denied",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Japanese fallback label when reverse-geocode fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) => {
          ok({
            coords: {
              latitude: 35.68,
              longitude: 139.76,
              accuracy: 100,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
      },
    });

    const result = await requestCurrentPlace(undefined, "ja");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.place.publicLabel).toBe("近く");
      expect(result.place.geo).toEqual({ lat: 35.68, lng: 139.76 });
    }
  });
});
