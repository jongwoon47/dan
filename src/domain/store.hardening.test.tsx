import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { useDan } from "@/domain/danContext";
import { DanProvider } from "@/domain/store";

function wrapper({ children }: { children: ReactNode }) {
  return <DanProvider>{children}</DanProvider>;
}

describe("store mutations / login race", () => {
  it("createDemand works after logout without a prior login flush", async () => {
    const { result } = renderHook(() => useDan(), { wrapper });

    act(() => {
      result.current.logout();
    });
    expect(result.current.isLoggedIn).toBe(false);

    let createdId: string | null = null;
    await act(async () => {
      const created = await result.current.createDemand({
        type: "BUY",
        title: "Phone",
        productId: "prod-iphone-15-pro",
        maxPrice: 1_111_000,
        conditionPreference: "any",
        fulfillmentOptions: [{ mode: "SHIPPING" }, { mode: "MEETUP", place: { publicLabel: "Seoul" } }],
      });
      createdId = created?.id ?? null;
    });

    expect(createdId).toBeTruthy();
    expect(result.current.isLoggedIn).toBe(true);
    expect(
      result.current.state.demands.filter(
        (d) =>
          d.userId === result.current.currentUser?.id &&
          d.type === "BUY" &&
          d.status === "ACTIVE",
      ),
    ).toHaveLength(1);
  });

  it("upserts demand instead of duplicating ACTIVE rows", async () => {
    const { result } = renderHook(() => useDan(), { wrapper });
    const productId = "prod-airpods-pro2";

    await act(async () => {
      await result.current.createDemand({
        type: "BUY",
        title: "AirPods",
        productId,
        maxPrice: 1_000_000,
        conditionPreference: "any",
        fulfillmentOptions: [{ mode: "SHIPPING" }, { mode: "MEETUP", place: { publicLabel: "Seoul" } }],
      });
    });
    await act(async () => {
      await result.current.createDemand({
        type: "BUY",
        title: "AirPods",
        productId,
        maxPrice: 2_000_000,
        conditionPreference: "sealed",
        fulfillmentOptions: [{ mode: "SHIPPING" }, { mode: "MEETUP", place: { publicLabel: "Seoul" } }],
      });
    });

    const mine = result.current.state.demands.filter(
      (d) =>
        d.userId === result.current.currentUser?.id &&
        d.type === "BUY" &&
        d.details.productId === productId &&
        d.status === "ACTIVE",
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]?.type === "BUY" && mine[0].details.maxPrice).toBe(2_000_000);
  });

  it("rejects seller connect on derived POTENTIAL via reducer", async () => {
    const { result } = renderHook(() => useDan(), { wrapper });

    act(() => {
      result.current.login("user-jun");
    });

    const potential = result.current.myMatches.find((m) => m.status === "POTENTIAL");
    expect(potential).toBeTruthy();

    await act(async () => {
      await result.current.connectAsSeller(potential!.id);
    });

    const after = result.current.myMatches.find(
      (m) =>
        m.demandId === potential!.demandId &&
        m.sellIntentId === potential!.sellIntentId,
    );
    expect(after?.status).toBe("POTENTIAL");
    expect(
      result.current.state.matches.find(
        (m) =>
          m.demandId === potential!.demandId &&
          m.sellIntentId === potential!.sellIntentId,
      ),
    ).toBeUndefined();
  });

  it("buyer interest materializes, then seller can connect", async () => {
    const { result } = renderHook(() => useDan(), { wrapper });

    act(() => {
      result.current.login("user-you");
    });
    await act(async () => {
      await result.current.createDemand({
        type: "BUY",
        title: "Sony A7 IV",
        productId: "prod-sony-a7iv",
        maxPrice: 2_500_000,
        conditionPreference: "any",
        fulfillmentOptions: [{ mode: "SHIPPING" }, { mode: "MEETUP", place: { publicLabel: "Seoul" } }],
      });
    });

    const asBuyer = result.current.myMatches.find(
      (m) => m.status === "POTENTIAL" && m.buyerId === "user-you",
    );
    expect(asBuyer).toBeTruthy();

    await act(async () => {
      await result.current.expressBuyerInterest(asBuyer!.id);
    });

    const interested = result.current.state.matches.find(
      (m) => m.buyerId === "user-you" && m.status === "BUYER_INTERESTED",
    );
    expect(interested).toBeTruthy();

    act(() => {
      result.current.login("user-jun");
    });
    await act(async () => {
      await result.current.connectAsSeller(interested!.id);
    });

    expect(
      result.current.state.matches.find((m) => m.id === interested!.id)?.status,
    ).toBe("CONNECTED");
  });

  it("accepting one TASK response connects once and declines the other", async () => {
    const { result } = renderHook(() => useDan(), { wrapper });

    act(() => {
      result.current.login("user-you");
    });
    let demandId = "";
    await act(async () => {
      const created = await result.current.createDemand({
        type: "TASK",
        title: "케이크 픽업",
        taskDescription: "강남역 픽업",
        budget: 15000,
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        fulfillmentOptions: [{ mode: "REMOTE" }],
      });
      demandId = created!.id;
    });

    act(() => {
      result.current.login("user-jun");
    });
    let firstResponseId = "";
    await act(async () => {
      const r = await result.current.createResponse({
        demandId,
        message: "제가 할게요",
      });
      firstResponseId = r!.id;
    });

    act(() => {
      result.current.login("user-mina");
    });
    let secondResponseId = "";
    await act(async () => {
      const r = await result.current.createResponse({
        demandId,
        message: "저도 가능해요",
      });
      secondResponseId = r!.id;
    });

    act(() => {
      result.current.login("user-you");
    });
    await act(async () => {
      await result.current.acceptResponse(firstResponseId);
    });
    await act(async () => {
      await result.current.acceptResponse(secondResponseId);
    });

    const connected = result.current.state.matches.filter(
      (m) => m.demandId === demandId && m.status === "CONNECTED",
    );
    expect(connected).toHaveLength(1);
    expect(connected[0]?.responseId).toBe(firstResponseId);
    expect(
      result.current.state.responses.find((r) => r.id === secondResponseId)?.status,
    ).toBe("DECLINED");
    expect(
      result.current.state.demands.find((d) => d.id === demandId)?.status,
    ).toBe("MATCHED");
  });

  it("closeMatch keeps demand MATCHED; owner can reopen to ACTIVE", async () => {
    const { result } = renderHook(() => useDan(), { wrapper });
    act(() => {
      result.current.login("user-you");
    });

    let demandId = "";
    await act(async () => {
      const d = await result.current.createDemand({
        type: "TASK",
        title: "재오픈 테스트",
        taskDescription: "심부름",
        budget: 10000,
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        fulfillmentOptions: [{ mode: "REMOTE" }],
      });
      demandId = d!.id;
    });

    act(() => {
      result.current.login("user-jun");
    });
    let responseId = "";
    await act(async () => {
      const r = await result.current.createResponse({
        demandId,
        message: "할게요",
      });
      responseId = r!.id;
    });

    act(() => {
      result.current.login("user-you");
    });
    await act(async () => {
      await result.current.acceptResponse(responseId);
    });
    const matchId = result.current.state.matches.find(
      (m) => m.demandId === demandId && m.status === "CONNECTED",
    )?.id;
    expect(matchId).toBeTruthy();

    await act(async () => {
      await result.current.closeMatch(matchId!);
    });
    expect(
      result.current.state.matches.find((m) => m.id === matchId)?.status,
    ).toBe("CLOSED");
    expect(
      result.current.state.demands.find((d) => d.id === demandId)?.status,
    ).toBe("MATCHED");

    act(() => {
      result.current.login("user-jun");
    });
    await act(async () => {
      const denied = await result.current.reopenDemandAfterTradeClose(matchId!);
      expect(denied).toBeNull();
    });
    expect(
      result.current.state.demands.find((d) => d.id === demandId)?.status,
    ).toBe("MATCHED");

    act(() => {
      result.current.login("user-you");
    });
    await act(async () => {
      const reopened = await result.current.reopenDemandAfterTradeClose(matchId!);
      expect(reopened?.status).toBe("ACTIVE");
    });
    expect(
      result.current.state.demands.find((d) => d.id === demandId)?.status,
    ).toBe("ACTIVE");
  });
});
