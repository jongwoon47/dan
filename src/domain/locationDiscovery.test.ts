import { describe, expect, it } from "vitest";
import {
  distanceRequestBatches,
  hasPhysicalFulfillment,
  matchesLocationDiscovery,
  type LocationDemand,
} from "./locationDiscovery";

const onsite: LocationDemand = {
  id: "onsite",
  fulfillmentOptions: [{ mode: "ONSITE", place: { publicLabel: "후쿠오카시 하카타구", region2: "하카타구" } }],
};
const mixed: LocationDemand = {
  id: "mixed",
  fulfillmentOptions: [
    { mode: "MEETUP", place: { publicLabel: "서울 성동구", region2: "성동구" } },
    { mode: "SHIPPING" },
  ],
};
const online: LocationDemand = { id: "online", fulfillmentOptions: [{ mode: "REMOTE" }] };
const unknown: LocationDemand = { id: "unknown", fulfillmentOptions: [{ mode: "PICKUP", place: { publicLabel: "장소 미상" } }] };
const filter = (mode: "all" | "nearby" | "area" | "online", areaQuery = "") => ({
  mode,
  radiusKm: 3,
  areaQuery,
  approximateMetersById: { onsite: 2750, mixed: 3500 },
});

describe("location discovery", () => {
  it("filters only known server approximate distances within radius", () => {
    expect(matchesLocationDiscovery(onsite, filter("nearby"))).toBe(true);
    expect(matchesLocationDiscovery(mixed, filter("nearby"))).toBe(false);
    expect(matchesLocationDiscovery(unknown, filter("nearby"))).toBe(false);
    expect(matchesLocationDiscovery(online, filter("nearby"))).toBe(false);
    expect(hasPhysicalFulfillment(onsite)).toBe(true);
  });
  it("matches explicitly labeled area without claiming GPS distance", () => {
    expect(matchesLocationDiscovery(onsite, filter("area", "ハカタ"))).toBe(false);
    expect(matchesLocationDiscovery(onsite, filter("area", "하카타구"))).toBe(true);
    expect(matchesLocationDiscovery(mixed, filter("area", "성동구"))).toBe(true);
    expect(matchesLocationDiscovery(online, filter("area", "서울"))).toBe(false);
    expect(matchesLocationDiscovery(onsite, filter("area", ""))).toBe(false);
  });
  it("keeps remote/shipping separate from physical and all", () => {
    expect(matchesLocationDiscovery(online, filter("online"))).toBe(true);
    expect(matchesLocationDiscovery(mixed, filter("online"))).toBe(true);
    expect(matchesLocationDiscovery(onsite, filter("online"))).toBe(false);
    expect(matchesLocationDiscovery(onsite, filter("all"))).toBe(true);
  });
  it("batches RPC calls at 40 IDs and eliminates duplicates", () => {
    const batches = distanceRequestBatches([...Array.from({ length: 81 }, (_, i) => String(i)), "0"]);
    expect(batches.map((batch) => batch.length)).toEqual([40, 40, 1]);
    expect(batches[0][0]).toBe("0");
    expect(() => distanceRequestBatches(["x"], 41)).toThrow();
  });
  it("does not accept non-finite or negative distances", () => {
    expect(matchesLocationDiscovery(onsite, { ...filter("nearby"), approximateMetersById: { onsite: Number.NaN } })).toBe(false);
    expect(matchesLocationDiscovery(onsite, { ...filter("nearby"), approximateMetersById: { onsite: -1 } })).toBe(false);
  });
});
