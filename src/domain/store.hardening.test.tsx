import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { useDan } from "@/domain/danContext";
import { DanProvider } from "@/domain/store";

function wrapper({ children }: { children: ReactNode }) {
  return <DanProvider>{children}</DanProvider>;
}

describe("store mutations / login race", () => {
  it("createDemand works after logout without a prior login flush", () => {
    const { result } = renderHook(() => useDan(), { wrapper });

    act(() => {
      result.current.logout();
    });
    expect(result.current.isLoggedIn).toBe(false);

    let createdId: string | null = null;
    act(() => {
      const created = result.current.createDemand({
        type: "BUY",
        title: "Phone",
        productId: "prod-iphone-15-pro",
        maxPrice: 1_111_000,
        conditionPreference: "any",
        location: "Seoul",
        tradeMethod: "any",
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

  it("upserts demand instead of duplicating ACTIVE rows", () => {
    const { result } = renderHook(() => useDan(), { wrapper });
    const productId = "prod-airpods-pro2";

    act(() => {
      result.current.createDemand({
        type: "BUY",
        title: "AirPods",
        productId,
        maxPrice: 1_000_000,
        conditionPreference: "any",
        location: "Seoul",
        tradeMethod: "any",
      });
    });
    act(() => {
      result.current.createDemand({
        type: "BUY",
        title: "AirPods",
        productId,
        maxPrice: 2_000_000,
        conditionPreference: "sealed",
        location: "Busan",
        tradeMethod: "meetup",
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

  it("rejects seller connect on derived POTENTIAL via reducer", () => {
    const { result } = renderHook(() => useDan(), { wrapper });

    act(() => {
      result.current.login("user-jun");
    });

    const potential = result.current.myMatches.find((m) => m.status === "POTENTIAL");
    expect(potential).toBeTruthy();

    act(() => {
      result.current.connectAsSeller(potential!.id);
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

  it("buyer interest materializes, then seller can connect", () => {
    const { result } = renderHook(() => useDan(), { wrapper });

    act(() => {
      result.current.login("user-you");
    });
    act(() => {
      result.current.createDemand({
        type: "BUY",
        title: "Sony A7 IV",
        productId: "prod-sony-a7iv",
        maxPrice: 2_500_000,
        conditionPreference: "any",
        location: "Seoul",
        tradeMethod: "any",
      });
    });

    const asBuyer = result.current.myMatches.find(
      (m) => m.status === "POTENTIAL" && m.buyerId === "user-you",
    );
    expect(asBuyer).toBeTruthy();

    act(() => {
      result.current.expressBuyerInterest(asBuyer!.id);
    });

    const interested = result.current.state.matches.find(
      (m) => m.buyerId === "user-you" && m.status === "BUYER_INTERESTED",
    );
    expect(interested).toBeTruthy();

    act(() => {
      result.current.login("user-jun");
    });
    act(() => {
      result.current.connectAsSeller(interested!.id);
    });

    expect(
      result.current.state.matches.find((m) => m.id === interested!.id)?.status,
    ).toBe("CONNECTED");
  });
});
