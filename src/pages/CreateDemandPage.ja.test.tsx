import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { CreateDemandPage } from "./CreateDemandPage";

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    products: [],
    createDemand: vi.fn(),
    ensureProduct: vi.fn(),
    currentUser: null,
    isLoggedIn: false,
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
});

it("keeps Japan create gate locked with Japanese chrome", () => {
  setDanLocale("ja");
  render(
    <MemoryRouter initialEntries={["/create?country=JP"]}>
      <Routes>
        <Route path="/create" element={<CreateDemandPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { name: "日本向けの依頼は準備中です" })).toBeVisible();
  expect(screen.getByRole("link", { name: "韓国の依頼を探す" })).toBeVisible();
  expect(screen.queryByText("일본 거래 작성은 준비 중이에요")).toBeNull();
  // Gate must not expose demand-type authoring controls.
  expect(screen.queryByRole("radiogroup", { name: "依頼の種類" })).toBeNull();
  expect(screen.queryByRole("button", { name: /投稿|登録|作成/ })).toBeNull();
});

it("does not open JP create when only UI locale is Japanese", () => {
  setDanLocale("ja");
  render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreateDemandPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.queryByRole("heading", { name: "日本向けの依頼は準備中です" })).toBeNull();
  expect(screen.getByText("何が必要ですか？")).toBeVisible();
});

it("shows Japanese create placeholders and type-change label for locale=ja", async () => {
  setDanLocale("ja");
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreateDemandPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(screen.getByText("何が必要ですか？")).toBeVisible();
  await user.click(screen.getByRole("radio", { name: /買いたい/ }));
  expect(screen.getByLabelText("依頼の種類を変更")).toBeVisible();
  expect(screen.getByText("依頼の種類を変更")).toBeVisible();
  expect(screen.getByPlaceholderText("例：800,000")).toBeVisible();
  expect(screen.queryByPlaceholderText("예: 800,000")).toBeNull();
});
