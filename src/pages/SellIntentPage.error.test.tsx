import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { SellIntentPage } from "./SellIntentPage";

const createSellIntent = vi.fn(async () => null);

vi.mock("@/components/layout/ShellChrome", () => ({
  useDeepHeader: vi.fn(),
}));

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    myOwnerships: [
      {
        id: "own1",
        productId: "p1",
        userId: "u1",
        condition: "sealed",
        status: "OWNED",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    getProduct: (id: string) =>
      id === "p1"
        ? {
            id: "p1",
            name: "테스트 카메라",
            brand: "Test",
            category: "camera",
            imageUrl: "",
          }
        : undefined,
    getAggregate: () => ({ seekerCount: 1, highestIntentPrice: 100_000 }),
    createSellIntent,
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
  createSellIntent.mockClear();
});

it("announces sell-intent failure with role=alert", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/ownership/own1/sell-intent"]}>
      <Routes>
        <Route
          path="/ownership/:ownershipId/sell-intent"
          element={<SellIntentPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByDisplayValue("100,000")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "제안 보내기" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("잠시 후 다시 시도해 주세요.");
  expect(createSellIntent).toHaveBeenCalled();
});
