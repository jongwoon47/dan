import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const { getPublicProfile } = vi.hoisted(() => ({ getPublicProfile: vi.fn() }));
vi.mock("@/domain/danContext", () => ({
  useDan: () => ({ currentUser: null, getPublicProfile, myMatches: [] }),
}));
vi.mock("@/components/layout/ShellChrome", () => ({ useDeepHeader: vi.fn() }));

it("guides signed-out visitors to login without requesting an authenticated profile", () => {
  render(<MemoryRouter><ProfilePage /></MemoryRouter>);
  expect(screen.getByText("로그인이 필요해요")).toBeVisible();
  expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
  expect(getPublicProfile).not.toHaveBeenCalled();
  expect(screen.queryByText("잠시 후 다시 시도해 주세요.")).not.toBeInTheDocument();
});
