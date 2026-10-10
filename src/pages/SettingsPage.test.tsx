import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "self", name: "tester" } }),
}));
vi.mock("@/components/layout/ShellChrome", () => ({ useDeepHeader: vi.fn() }));

afterEach(cleanup);

it("exposes legal links separately from account deletion", () => {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { level: 2, name: "표시 언어" })).toBeInTheDocument();
  // Visible language label is the section heading only (select keeps aria-label).
  expect(screen.getByRole("combobox", { name: "표시 언어" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "법적 정보" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "저장된 지역" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "계정" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute(
    "href",
    expect.stringContaining("terms"),
  );
  expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
    "href",
    expect.stringContaining("privacy"),
  );
  expect(screen.getByRole("link", { name: "고객지원" })).toHaveAttribute(
    "href",
    expect.stringContaining("support"),
  );
  expect(screen.getByRole("link", { name: "회원탈퇴" })).toHaveAttribute(
    "href",
    "/settings/delete-account",
  );
});

it("routes Japanese locale settings legal links under /ja/", async () => {
  const { setDanLocale } = await import("@/i18n/locale");
  setDanLocale("ja");
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute(
    "href",
    expect.stringContaining("/ja/terms/"),
  );
  expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute(
    "href",
    expect.stringContaining("/ja/privacy/"),
  );
  expect(screen.getByRole("link", { name: "サポート" })).toHaveAttribute(
    "href",
    expect.stringContaining("/ja/support/"),
  );
  setDanLocale("ko");
});

it("shows JP pilot write-lock honesty when Japan market is selected", async () => {
  const user = (await import("@testing-library/user-event")).default.setup();
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
  await user.selectOptions(screen.getByLabelText("거래 국가/지역"), "JP");
  const note = screen.getByRole("note");
  expect(note).toHaveTextContent(/일본 파일럿 지역은 아직 쓰기·생성 잠금/);
  expect(note).toBeVisible();
});
