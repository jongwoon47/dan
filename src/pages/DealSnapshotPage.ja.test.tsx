import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { DealSnapshotPage } from "./DealSnapshotPage";

vi.mock("@/components/layout/ShellChrome", () => ({ useDeepHeader: vi.fn() }));
vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    currentUser: { id: "peer" },
    myMatches: [
      {
        id: "match",
        demandId: "demand",
        productId: "product",
        sellIntentId: "sell",
        buyerId: "peer",
        status: "COMPLETED",
      },
    ],
    state: { sellIntents: [{ id: "sell", minimumPrice: 15000 }] },
    getDemand: () => ({ fulfillmentOptions: [], currencyCode: "KRW" }),
    getProduct: () => ({ id: "product", name: "item" }),
    getDealEvidence: async () => null,
    getDealSnapshot: async () => ({
      agreedPrice: 15000,
      currencyCode: "KRW",
      lockedAt: "2026-10-06",
      snapshot: { accountDeleted: true },
    }),
    confirmDealSnapshot: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
});

it("shows Japanese closed-deal chrome for locale=ja", async () => {
  setDanLocale("ja");
  render(
    <MemoryRouter initialEntries={["/deal/match/snapshot"]}>
      <Routes>
        <Route path="/deal/:matchId/snapshot" element={<DealSnapshotPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole("heading", { name: "終了した取引記録" })).toBeVisible();
  expect(screen.getByText(/合意金額/)).toBeVisible();
  expect(screen.queryByRole("link", { name: "商品情報を登録" })).not.toBeInTheDocument();
});
