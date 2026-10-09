import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabase } = vi.hoisted(() => ({
  getSupabase: vi.fn(),
}));

vi.mock("./client", () => ({ getSupabase }));

import {
  blockUserRemote,
  cancelDealRemote,
  reportUserRemote,
  unblockUserRemote,
} from "./api";

describe("report / block / cancel RPC wrappers", () => {
  beforeEach(() => {
    getSupabase.mockReset();
  });

  it("blockUserRemote calls block_user with p_blocked_id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getSupabase.mockReturnValue({ rpc });
    await blockUserRemote("user-target");
    expect(rpc).toHaveBeenCalledWith("block_user", {
      p_blocked_id: "user-target",
    });
  });

  it("unblockUserRemote calls unblock_user", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getSupabase.mockReturnValue({ rpc });
    await unblockUserRemote("user-target");
    expect(rpc).toHaveBeenCalledWith("unblock_user", {
      p_blocked_id: "user-target",
    });
  });

  it("reportUserRemote calls submit_user_report with reason/detail", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getSupabase.mockReturnValue({ rpc });
    await reportUserRemote({
      targetUserId: "user-target",
      reason: "spam",
      detail: "flooding offers",
    });
    expect(rpc).toHaveBeenCalledWith("submit_user_report", {
      p_target_user_id: "user-target",
      p_reason: "spam",
      p_detail: "flooding offers",
    });
  });

  it("reportUserRemote defaults empty detail", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    getSupabase.mockReturnValue({ rpc });
    await reportUserRemote({
      targetUserId: "user-target",
      reason: "abuse",
    });
    expect(rpc).toHaveBeenCalledWith("submit_user_report", {
      p_target_user_id: "user-target",
      p_reason: "abuse",
      p_detail: "",
    });
  });

  it("cancelDealRemote calls cancel_deal and maps CLOSED/CANCELLED match", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "match-1",
        demand_id: "demand-1",
        sell_intent_id: "offer-1",
        response_id: null,
        product_id: "prod-1",
        buyer_id: "buyer-1",
        seller_id: "seller-1",
        status: "CLOSED",
        deal_stage: "CANCELLED",
        payment_status: "NOT_STARTED",
        payment_due_at: null,
        cancel_reason: "BUYER_CHANGED_MIND",
        cancelled_by: "buyer-1",
        cancel_fault_party: null,
        created_at: "2026-10-01T00:00:00.000Z",
        buyer_completed_at: null,
        seller_completed_at: null,
        completed_at: null,
      },
      error: null,
    });
    getSupabase.mockReturnValue({ rpc });
    const match = await cancelDealRemote({
      matchId: "match-1",
      reason: "BUYER_CHANGED_MIND",
    });
    expect(rpc).toHaveBeenCalledWith("cancel_deal", {
      p_match_id: "match-1",
      p_reason: "BUYER_CHANGED_MIND",
    });
    expect(match).toMatchObject({
      id: "match-1",
      status: "CLOSED",
      dealStage: "CANCELLED",
      cancelReason: "BUYER_CHANGED_MIND",
      cancelledBy: "buyer-1",
    });
  });

  it("surfaces RPC errors from block / report / cancel", async () => {
    const boom = { message: "not authenticated" };
    const rpc = vi.fn().mockResolvedValue({ data: null, error: boom });
    getSupabase.mockReturnValue({ rpc });
    await expect(blockUserRemote("x")).rejects.toEqual(boom);
    await expect(
      reportUserRemote({ targetUserId: "x", reason: "other" }),
    ).rejects.toEqual(boom);
    await expect(
      cancelDealRemote({ matchId: "m", reason: "MUTUAL_CANCEL" }),
    ).rejects.toEqual(boom);
  });
});
