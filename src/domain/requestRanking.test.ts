import { describe, expect, it } from "vitest";
import { rankEligibleRequests, type RankableDemand } from "./requestRanking";

function row(
  partial: Partial<RankableDemand> & Pick<RankableDemand, "id" | "type">,
): RankableDemand {
  return {
    createdAt: partial.createdAt ?? "2026-10-01T00:00:00.000Z",
    status: partial.status ?? "ACTIVE",
    countryCode: partial.countryCode ?? "KR",
    fulfillmentOptions: partial.fulfillmentOptions ?? [
      { mode: "MEETUP", place: { publicLabel: "성동구", region2: "성동구" } },
    ],
    ...partial,
  };
}

describe("rankEligibleRequests", () => {
  it("keeps market partition and sorts nearest then newer", () => {
    const rows = [
      row({ id: "a", type: "TASK", createdAt: "2026-10-02T00:00:00.000Z" }),
      row({ id: "b", type: "TASK", createdAt: "2026-10-03T00:00:00.000Z", countryCode: "JP" }),
      row({ id: "c", type: "BUY", createdAt: "2026-10-04T00:00:00.000Z" }),
      row({ id: "d", type: "TASK", createdAt: "2026-10-01T00:00:00.000Z", status: "CLOSED" }),
    ];
    const ranked = rankEligibleRequests(rows, {
      marketCountry: "KR",
      requestType: "TASK",
      sort: "nearest",
      approximateMetersById: { a: 3000, c: 1000 },
      location: {
        mode: "nearby",
        radiusKm: 5,
        areaQuery: "",
        approximateMetersById: { a: 3000, c: 1000 },
      },
    });
    expect(ranked.map((item) => item.id)).toEqual(["a"]);
  });

  it("sorts newest when distances are absent", () => {
    const rows = [
      row({ id: "older", type: "SERVICE", createdAt: "2026-09-01T00:00:00.000Z" }),
      row({ id: "newer", type: "SERVICE", createdAt: "2026-10-01T00:00:00.000Z" }),
    ];
    const ranked = rankEligibleRequests(rows, {
      marketCountry: "KR",
      requestType: "all",
      sort: "newest",
      approximateMetersById: {},
      location: {
        mode: "all",
        radiusKm: 3,
        areaQuery: "",
        approximateMetersById: {},
      },
    });
    expect(ranked.map((item) => item.id)).toEqual(["newer", "older"]);
  });
});
