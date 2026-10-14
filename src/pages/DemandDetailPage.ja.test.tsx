import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { DemandDetailPage } from "./DemandDetailPage";

vi.mock("@/components/layout/ShellChrome", () => ({ useDeepHeader: vi.fn() }));
vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    currentUser: { id: "seller" },
    myOwnerships: [],
    myDemands: [],
    getProduct: () => ({
      id: "prod-aeron-chair",
      name: "Herman Miller Aeron Chair",
      brand: "Herman Miller",
      category: "furniture",
    }),
    getAggregate: () => ({
      seekerCount: 3,
      highestIntentPrice: 800_000,
      fulfillmentSummary: "配送",
    }),
    state: { demands: [] },
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
});

it("shows Japanese BUY aggregation chrome for locale=ja", () => {
  setDanLocale("ja");
  render(
    <MemoryRouter initialEntries={["/demand/prod-aeron-chair"]}>
      <Routes>
        <Route path="/demand/:productId" element={<DemandDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("今探している人")).toBeVisible();
  expect(screen.getByRole("link", { name: "提案を送る" })).toBeVisible();
  expect(screen.getByText(/800,000/)).toBeVisible();
});
