import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShellChromeProvider } from "@/components/layout/ShellChrome";
import { DanProvider } from "@/domain/store";
import { SafePaymentPage } from "./SafePaymentPage";

vi.mock("@/data/mode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/mode")>();
  return {
    ...actual,
    getDataMode: () => "supabase" as const,
  };
});

const STORE_KEY = "dan-v2-fulfillment-store";

function installLockedDeal() {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  localStorage.setItem(
    STORE_KEY,
    JSON.stringify({
      currentUserId: "user-you",
      demands: [
        {
          id: "pay-demand",
          userId: "user-you",
          type: "BUY",
          title: "Fujifilm X100VI",
          description: "payment gate",
          category: "camera",
          budget: 2130000,
          fulfillmentOptions: [{ mode: "MEETUP", place: { publicLabel: "서울" } }],
          status: "MATCHED",
          createdAt: now,
          expiresAt: future,
          details: {
            productId: "prod-fuji-x100vi",
            maxPrice: 2130000,
            conditionPreference: "any",
            tradeMethod: "meetup",
          },
        },
      ],
      ownerships: [],
      sellIntents: [],
      responses: [],
      matches: [
        {
          id: "pay-match",
          demandId: "pay-demand",
          productId: "prod-fuji-x100vi",
          buyerId: "user-you",
          sellerId: "user-jun",
          status: "CONNECTED",
          dealStage: "PAYMENT_PENDING",
          paymentStatus: "PENDING",
          paymentDueAt: future,
          createdAt: now,
        },
      ],
      dealEvidence: [],
      dealSnapshots: [
        {
          id: "pay-snapshot",
          matchId: "pay-match",
          demandId: "pay-demand",
          productId: "prod-fuji-x100vi",
          buyerId: "user-you",
          sellerId: "user-jun",
          agreedPrice: 2130000,
          snapshot: { schemaVersion: "dan.deal_snapshot.v1" },
          buyerConfirmedAt: now,
          sellerConfirmedAt: now,
          lockedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ],
      dealEvidenceChallenges: [],
      dealDisputes: [],
    }),
  );
}

describe("SafePaymentPage production gate", () => {
  beforeEach(() => {
    localStorage.clear();
    installLockedDeal();
  });

  it("does not offer a demo payment that could mark the deal paid", async () => {
    render(
      <ShellChromeProvider>
        <DanProvider>
          <MemoryRouter initialEntries={["/deal/pay-match/payment"]}>
            <Routes>
              <Route path="/deal/:matchId/payment" element={<SafePaymentPage />} />
            </Routes>
          </MemoryRouter>
        </DanProvider>
      </ShellChromeProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "현재는 실제 결제를 받을 수 없어요.",
      }),
    ).toBeVisible();
    expect(screen.getByText("결제 기능이 연결되기 전까지는 거래 조건 확인까지만 진행할 수 있어요.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /결제하기/ })).toBeNull();
    await waitFor(() => {
      expect(localStorage.getItem(STORE_KEY)).not.toContain('"paymentStatus":"PAID"');
    });
  });
});
