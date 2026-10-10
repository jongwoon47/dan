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
  expect(screen.getByRole("heading", { name: "법적 정보" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute(
    "href",
    expect.stringContaining("terms"),
  );
  expect(screen.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute(
    "href",
    expect.stringContaining("privacy"),
  );
  expect(screen.getByRole("link", { name: "회원탈퇴" })).toHaveAttribute(
    "href",
    "/settings/delete-account",
  );
});
