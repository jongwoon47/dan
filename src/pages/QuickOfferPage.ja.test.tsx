import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { QuickOfferPage } from "./QuickOfferPage";

const useDeepHeader = vi.fn();

vi.mock("@/components/layout/ShellChrome", () => ({
  useDeepHeader: (...args: unknown[]) => useDeepHeader(...args),
}));

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    getProduct: () => ({
      id: "prod-aeron-chair",
      name: "Herman Miller Aeron Chair",
      brand: "Herman Miller",
      category: "furniture",
    }),
    getDemand: () => undefined,
    getAggregate: () => ({
      seekerCount: 2,
      highestIntentPrice: 800_000,
    }),
    myOwnerships: [],
    createOwnership: vi.fn(),
    createSellIntent: vi.fn(),
    isLoggedIn: true,
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
  useDeepHeader.mockReset();
});

it("shows Japanese QuickOffer chrome for locale=ja", () => {
  setDanLocale("ja");
  render(
    <MemoryRouter initialEntries={["/demand/prod-aeron-chair/offer"]}>
      <Routes>
        <Route path="/demand/:productId/offer" element={<QuickOfferPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(useDeepHeader).toHaveBeenCalledWith({ title: "販売提案をする" });
  expect(screen.getByText("販売提案")).toBeVisible();
  expect(screen.getByText("希望販売価格")).toBeVisible();
  expect(screen.getByRole("button", { name: "提案を送る" })).toBeVisible();
  expect(screen.queryByText("판매 제안하기")).toBeNull();
  expect(screen.queryByText("제안 보내기")).toBeNull();
});
