import { describe, expect, it } from "vitest";
import { buildPublicProfileStats } from "./profileTrust";
import type { Demand, Match } from "./types";

function demand(partial: Partial<Demand> & Pick<Demand, "id" | "userId" | "status" | "type">): Demand {
  return {
    title: partial.title ?? "테스트",
    description: "",
    createdAt: partial.createdAt ?? "2026-09-01T00:00:00.000Z",
    budgetMax: null,
    currency: "KRW",
    ...partial,
  } as unknown as Demand;
}

describe("buildPublicProfileStats", () => {
  it("counts COMPLETED matches only and redacts peer titles", () => {
    const demands: Demand[] = [
      demand({
        id: "d1",
        userId: "u1",
        type: "BUY",
        status: "MATCHED",
        title: "아이폰 찾기",
        createdAt: "2026-09-10T00:00:00.000Z",
      }),
      demand({
        id: "d2",
        userId: "u1",
        type: "SERVICE",
        status: "ACTIVE",
        title: "비밀 심부름",
      }),
    ];
    const matches: Match[] = [
      {
        id: "m1",
        demandId: "d1",
        buyerId: "u1",
        sellerId: "u2",
        status: "COMPLETED",
        createdAt: "2026-09-11T00:00:00.000Z",
        completedAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "m2",
        demandId: "d9",
        buyerId: "u3",
        sellerId: "u1",
        status: "CONNECTED",
        createdAt: "2026-09-12T00:00:00.000Z",
      },
      {
        id: "m3",
        demandId: "d1",
        buyerId: "u9",
        sellerId: "u1",
        status: "CONNECTED",
        createdAt: "2026-09-13T00:00:00.000Z",
      },
    ];

    const self = buildPublicProfileStats({
      userId: "u1",
      displayName: "룰루",
      defaultArea: "과천",
      bio: "",
      createdAt: "2026-09-14T00:00:00.000Z",
      demands,
      matches,
      viewerIsSelf: true,
    });
    expect(self.completedDemandCount).toBe(1);
    expect(self.responseConnectionCount).toBe(2);
    expect(self.connectionCount).toBe(3);
    expect(self.recentActivity[0]?.label).toContain("아이폰 찾기");
    expect(self.recentActivity[0]?.href).toBe("/match/m1");

    const peer = buildPublicProfileStats({
      userId: "u1",
      displayName: "룰루",
      defaultArea: "과천",
      bio: "",
      createdAt: "2026-09-14T00:00:00.000Z",
      demands,
      matches,
      viewerIsSelf: false,
    });
    expect(peer.recentActivity[0]?.label).not.toContain("아이폰");
    expect(peer.recentActivity[0]?.label).toContain("거래 완료");
    expect(peer.recentActivity[0]?.href).toBe("/match/m1");
  });

  it("returns zero activity when nothing finished", () => {
    const profile = buildPublicProfileStats({
      userId: "u1",
      displayName: "룰루",
      defaultArea: "과천",
      bio: "",
      createdAt: "2026-09-14T00:00:00.000Z",
      demands: [],
      matches: [],
      viewerIsSelf: true,
    });
    expect(profile.completedDemandCount).toBe(0);
    expect(profile.responseConnectionCount).toBe(0);
    expect(profile.recentActivity).toEqual([]);
  });
});
