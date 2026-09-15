import { describe, expect, it } from "vitest";
import {
  defaultExpiresAtIso,
  effectiveDemandStatus,
  isDemandOpen,
} from "@/domain/demandLifecycle";
import type { ServiceDemand } from "@/domain/types";
import {
  distanceMeters,
  formatApproxDistance,
  formatPublicPlaceLine,
} from "@/lib/geoDistance";

function service(partial: Partial<ServiceDemand> & { preferredAt?: string }): ServiceDemand {
  return {
    id: "d1",
    userId: "u1",
    type: "SERVICE",
    title: "BX",
    description: "BX",
    category: "service",
    budget: 1000,
    fulfillmentOptions: [{ mode: "ONSITE", place: { publicLabel: "평택" } }],
    status: "ACTIVE",
    createdAt: "2026-09-15T00:00:00.000Z",
    expiresAt: partial.expiresAt ?? "2099-01-01T00:00:00.000Z",
    details: {
      serviceDescription: "BX",
      preferredAt: partial.preferredAt,
    },
    ...partial,
  };
}

describe("demandLifecycle", () => {
  it("SERVICE expires at preferredAt", () => {
    const at = "2026-09-15T10:00:00.000Z";
    expect(defaultExpiresAtIso("SERVICE", at)).toBe(new Date(at).toISOString());
    expect(defaultExpiresAtIso("BUY")).toMatch(/^20/);
  });

  it("past preferredAt is not open even if expiresAt is far", () => {
    const d = service({
      preferredAt: "2026-09-14T10:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const now = Date.parse("2026-09-15T12:00:00.000Z");
    expect(effectiveDemandStatus(d, now)).toBe("EXPIRED");
    expect(isDemandOpen(d, now)).toBe(false);
  });

  it("MATCHED stays MATCHED", () => {
    const d = service({
      status: "MATCHED",
      preferredAt: "2026-09-14T10:00:00.000Z",
    });
    expect(effectiveDemandStatus(d, Date.parse("2026-09-15T12:00:00.000Z"))).toBe(
      "MATCHED",
    );
  });
});

describe("geoDistance", () => {
  it("formats meters and km", () => {
    expect(formatApproxDistance(800)).toBe("약 800m");
    expect(formatApproxDistance(2300)).toBe("약 2.3km");
  });

  it("prefers distance when both sides have geo", () => {
    const line = formatPublicPlaceLine(
      {
        publicLabel: "평택시 · 부대 근처",
        region2: "평택시",
        geo: { lat: 36.99, lng: 127.09 },
      },
      { lat: 36.992, lng: 127.091 },
    );
    expect(line.startsWith("약 ")).toBe(true);
  });

  it("hides detail for geo without viewer", () => {
    expect(
      formatPublicPlaceLine({
        publicLabel: "평택시 · 부대 근처",
        region2: "평택시",
        geo: { lat: 36.99, lng: 127.09 },
      }),
    ).toBe("평택시");
  });

  it("keeps text-entered labels", () => {
    expect(
      formatPublicPlaceLine({ publicLabel: "평택역 근처" }),
    ).toBe("평택역 근처");
  });

  it("distanceMeters is finite nearby", () => {
    const m = distanceMeters(
      { lat: 36.99, lng: 127.09 },
      { lat: 36.991, lng: 127.091 },
    );
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(5000);
  });
});
