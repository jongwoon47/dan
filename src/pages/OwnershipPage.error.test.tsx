import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { OwnershipPage } from "./OwnershipPage";

const createOwnership = vi.fn(async () => null);

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
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
    getAggregate: () => null,
    createOwnership,
  }),
}));

vi.mock("@/lib/actionDraft", () => ({
  loadOwnDraft: () => null,
  saveOwnDraft: () => undefined,
  clearOwnDraft: () => undefined,
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
  createOwnership.mockClear();
});

it("announces ownership registration failure with role=alert", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/demand/p1/own"]}>
      <Routes>
        <Route path="/demand/:productId/own" element={<OwnershipPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("button", { name: "미개봉" }));
  await user.click(screen.getByRole("button", { name: "내 물건으로 등록" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("잠시 후 다시 시도해 주세요.");
  expect(createOwnership).toHaveBeenCalled();
});
