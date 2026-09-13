import { describe, expect, it } from "vitest";
import { getDataMode, isSupabaseConfigured } from "@/data/mode";
import { mapDemand, mapMatch, type DbDemand, type DbMatch } from "@/data/supabase/mappers";
import { canExpressBuyerInterest, canSellerConnect } from "@/domain/matchLifecycle";

describe("data mode", () => {
  it("defaults to demo in test env", () => {
    expect(getDataMode()).toBe("demo");
    expect(isSupabaseConfigured()).toBe(false);
  });
});

describe("mappers", () => {
  it("maps TASK demand", () => {
    const row: DbDemand = {
      id: "d1",
      user_id: "u1",
      type: "TASK",
      title: "케이크 픽업",
      description: "평택",
      category: "errand",
      budget: 15000,
      location: "평택",
      status: "ACTIVE",
      product_id: null,
      max_price: null,
      condition_preference: null,
      trade_method: null,
      item_name: null,
      start_at: null,
      end_at: null,
      task_description: "케이크 받아주세요",
      service_description: null,
      preferred_at: null,
      due_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const d = mapDemand(row);
    expect(d.type).toBe("TASK");
    expect(d.budget).toBe(15000);
    expect(d.fulfillmentOptions.length).toBeGreaterThan(0);
  });

  it("prefers fulfillment_options JSONB over legacy location", () => {
    const row: DbDemand = {
      id: "d2",
      user_id: "u1",
      type: "SERVICE",
      title: "PPT 수정",
      description: "온라인",
      category: "service",
      budget: 30000,
      location: "평택",
      fulfillment_options: [
        { mode: "REMOTE" },
        {
          mode: "ROUTE",
          from: { publicLabel: "평택역" },
          to: { publicLabel: "고덕" },
        },
      ],
      status: "ACTIVE",
      product_id: null,
      max_price: null,
      condition_preference: null,
      trade_method: null,
      item_name: null,
      start_at: null,
      end_at: null,
      task_description: null,
      service_description: "PPT 수정",
      preferred_at: null,
      due_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const d = mapDemand(row);
    expect(d.fulfillmentOptions).toEqual([
      { mode: "REMOTE" },
      {
        mode: "ROUTE",
        from: { publicLabel: "평택역" },
        to: { publicLabel: "고덕" },
      },
    ]);
  });

  it("parses fulfillment_options when returned as JSON string", () => {
    const row: DbDemand = {
      id: "d3",
      user_id: "u1",
      type: "BORROW",
      title: "드릴",
      description: "빌려요",
      category: "rental",
      budget: 0,
      location: "요약",
      fulfillment_options: JSON.stringify([
        { mode: "PICKUP", place: { publicLabel: "고덕동" } },
      ]),
      status: "ACTIVE",
      product_id: null,
      max_price: null,
      condition_preference: null,
      trade_method: null,
      item_name: "드릴",
      start_at: null,
      end_at: null,
      task_description: null,
      service_description: null,
      preferred_at: null,
      due_at: null,
      expires_at: "2099-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const d = mapDemand(row);
    expect(d.fulfillmentOptions[0]).toMatchObject({
      mode: "PICKUP",
      place: { publicLabel: "고덕동" },
    });
  });

  it("never maps POTENTIAL match status from DB shape", () => {
    const row: DbMatch = {
      id: "m1",
      demand_id: "d1",
      sell_intent_id: "s1",
      response_id: null,
      product_id: "p1",
      buyer_id: "b1",
      seller_id: "s2",
      status: "BUYER_INTERESTED",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    expect(mapMatch(row).status).toBe("BUYER_INTERESTED");
  });
});

describe("match transition guards", () => {
  it("blocks seller connect from POTENTIAL", () => {
    expect(
      canSellerConnect({ status: "POTENTIAL", sellerId: "s1" }, "s1"),
    ).toBe(false);
    expect(
      canSellerConnect({ status: "BUYER_INTERESTED", sellerId: "s1" }, "s1"),
    ).toBe(true);
  });

  it("allows buyer interest only from POTENTIAL", () => {
    expect(
      canExpressBuyerInterest({ status: "POTENTIAL", buyerId: "b1" }, "b1"),
    ).toBe(true);
    expect(
      canExpressBuyerInterest({ status: "BUYER_INTERESTED", buyerId: "b1" }, "b1"),
    ).toBe(false);
  });
});
