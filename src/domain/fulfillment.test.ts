import { describe, expect, it } from "vitest";
import {
  areFulfillmentOptionsValid,
  extractExactGeo,
  formatFulfillmentCardLine,
  isFulfillmentCompatibleWithArea,
  placeFromLabel,
  stripGeoFromFulfillmentOptions,
  type FulfillmentOption,
} from "@/domain/fulfillment";
import { buildFeedItems } from "@/domain/feed";
import type { BuyDemand, Product, TaskDemand } from "@/domain/types";

describe("fulfillment validation", () => {
  it("allows REMOTE without place", () => {
    expect(areFulfillmentOptionsValid([{ mode: "REMOTE" }])).toBe(true);
  });

  it("allows SHIPPING without place", () => {
    expect(areFulfillmentOptionsValid([{ mode: "SHIPPING" }])).toBe(true);
  });

  it("requires place for MEETUP", () => {
    expect(
      areFulfillmentOptionsValid([
        { mode: "MEETUP", place: { publicLabel: "" } },
      ]),
    ).toBe(false);
    expect(
      areFulfillmentOptionsValid([
        { mode: "MEETUP", place: placeFromLabel("평택시") },
      ]),
    ).toBe(true);
  });

  it("requires place for ONSITE and PICKUP", () => {
    expect(
      areFulfillmentOptionsValid([
        { mode: "ONSITE", place: placeFromLabel("성동구") },
      ]),
    ).toBe(true);
    expect(
      areFulfillmentOptionsValid([
        { mode: "PICKUP", place: { publicLabel: "   " } },
      ]),
    ).toBe(false);
  });

  it("requires from/to for ROUTE", () => {
    expect(
      areFulfillmentOptionsValid([
        {
          mode: "ROUTE",
          from: placeFromLabel("평택역"),
          to: placeFromLabel("고덕"),
        },
      ]),
    ).toBe(true);
    expect(
      areFulfillmentOptionsValid([
        {
          mode: "ROUTE",
          from: placeFromLabel("평택역"),
          to: { publicLabel: "" },
        },
      ]),
    ).toBe(false);
  });

  it("allows BUY with SHIPPING + MEETUP", () => {
    const opts: FulfillmentOption[] = [
      { mode: "SHIPPING" },
      { mode: "MEETUP", place: placeFromLabel("평택시") },
    ];
    expect(areFulfillmentOptionsValid(opts)).toBe(true);
  });
});

describe("fulfillment rendering", () => {
  it("renders TASK ROUTE", () => {
    expect(
      formatFulfillmentCardLine([
        {
          mode: "ROUTE",
          from: placeFromLabel("평택역"),
          to: placeFromLabel("고덕"),
        },
      ]),
    ).toBe("평택역 → 고덕");
  });

  it("renders SERVICE REMOTE", () => {
    expect(formatFulfillmentCardLine([{ mode: "REMOTE" }])).toContain("온라인");
  });

  it("renders BORROW PICKUP", () => {
    expect(
      formatFulfillmentCardLine([
        { mode: "PICKUP", place: placeFromLabel("평택시 고덕동") },
      ]),
    ).toContain("고덕");
  });
});

describe("profile vs demand fulfillment", () => {
  it("does not treat profile defaultArea as fulfillment truth", () => {
    const demandArea = "강남역 근처";
    const profileDefault = "평택";
    expect(
      isFulfillmentCompatibleWithArea(
        [{ mode: "PICKUP", place: placeFromLabel(demandArea) }],
        profileDefault,
      ),
    ).toBe(false);
    expect(
      isFulfillmentCompatibleWithArea([{ mode: "REMOTE" }], profileDefault),
    ).toBe(true);
  });
});

describe("mixed feed ranking", () => {
  it("uses shared createdAt scale so aggregates are not always buried", () => {
    const product: Product = {
      id: "p-rank",
      name: "Rank Phone",
      brand: "X",
      model: "1",
      category: "electronics",
      imageHue: 200,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const buy: BuyDemand = {
      id: "b1",
      userId: "u1",
      type: "BUY",
      title: "Phone",
      description: "Phone",
      category: "electronics",
      budget: 100,
      fulfillmentOptions: [{ mode: "SHIPPING" }],
      status: "ACTIVE",
      createdAt: "2026-09-13T10:00:00.000Z",
      expiresAt: "2026-10-13T00:00:00.000Z",
      details: {
        productId: "p-rank",
        maxPrice: 100,
        conditionPreference: "any",
        tradeMethod: "shipping",
      },
    };
    const olderTask: TaskDemand = {
      id: "t-old",
      userId: "u2",
      type: "TASK",
      title: "Old task",
      description: "Old",
      category: "errand",
      budget: 10,
      fulfillmentOptions: [{ mode: "REMOTE" }],
      status: "ACTIVE",
      createdAt: "2026-09-10T00:00:00.000Z",
      expiresAt: "2026-10-13T00:00:00.000Z",
      details: { taskDescription: "Old" },
    };
    const feed = buildFeedItems([product], [buy, olderTask], {
      nowMs: Date.parse("2026-09-13T12:00:00.000Z"),
    });
    expect(feed[0]?.kind).toBe("aggregated");
    expect(feed[1]?.kind).toBe("individual");
  });
});

describe("GPS privacy helpers", () => {
  it("strips geo from public fulfillment options", () => {
    const raw: FulfillmentOption[] = [
      {
        mode: "ONSITE",
        place: {
          publicLabel: "평택시 · 부대 근처",
          region2: "평택시",
          geo: { lat: 36.99, lng: 127.09 },
        },
      },
    ];
    expect(extractExactGeo(raw)).toEqual({ lat: 36.99, lng: 127.09 });
    const publicOpts = stripGeoFromFulfillmentOptions(raw);
    expect(extractExactGeo(publicOpts)).toBeNull();
    expect(JSON.stringify(publicOpts)).not.toContain("geo");
  });
});
