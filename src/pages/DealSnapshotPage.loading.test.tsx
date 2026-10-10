import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellChromeProvider } from "@/components/layout/ShellChrome";
import { DealSnapshotPage } from "./DealSnapshotPage";

const getDealEvidence = vi.fn(
  () =>
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), 30);
    }),
);
const getDealSnapshot = vi.fn(async () => null);

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    myMatches: [
      {
        id: "m1",
        demandId: "d1",
        productId: "p1",
        sellIntentId: "s1",
        buyerId: "buyer",
        sellerId: "seller",
        status: "CONNECTED",
        dealStage: "DEAL_REVIEW",
        paymentStatus: "NONE",
      },
    ],
    state: {
      sellIntents: [
        {
          id: "s1",
          ownershipId: "o1",
          minimumPrice: 1000,
          conditionNote: "",
        },
      ],
    },
    getDemand: () => ({
      id: "d1",
      type: "BUY",
      currencyCode: "KRW",
      fulfillmentOptions: [{ mode: "MEETUP", place: { publicLabel: "서울" } }],
    }),
    getProduct: () => ({ id: "p1", name: "Test Cam", brand: "X", model: "1" }),
    currentUser: { id: "buyer" },
    getDealEvidence,
    getDealSnapshot,
    confirmDealSnapshot: vi.fn(),
    busy: false,
  }),
}));

afterEach(() => {
  cleanup();
  getDealEvidence.mockClear();
  getDealSnapshot.mockClear();
});

describe("DealSnapshotPage loading", () => {
  it("announces loading before treating missing evidence as empty", async () => {
    render(
      <ShellChromeProvider>
        <MemoryRouter initialEntries={["/deal/m1/snapshot"]}>
          <Routes>
            <Route path="/deal/:matchId/snapshot" element={<DealSnapshotPage />} />
          </Routes>
        </MemoryRouter>
      </ShellChromeProvider>,
    );

    expect(screen.getByRole("status", { busy: true })).toBeInTheDocument();
    expect(screen.getByText("불러오는 중")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("status", { name: /증거|상품 정보|evidence|情報/i })).toBeInTheDocument();
    });
  });
});
