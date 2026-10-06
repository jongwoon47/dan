import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const { availableSocialProviders, startSocialLogin, signIn } = vi.hoisted(() => ({
  availableSocialProviders: vi.fn(), startSocialLogin: vi.fn(), signIn: vi.fn(),
}));
vi.mock("@/auth/socialLogin", () => ({ availableSocialProviders, startSocialLogin }));
vi.mock("@/auth/AuthProvider", () => ({ useAuth: () => ({
  mode: "supabase", status: "anonymous", signIn, signUp: vi.fn(), error: null, clearError: vi.fn(),
}) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("does not advertise unconfigured providers as usable", async () => {
  availableSocialProviders.mockResolvedValue([]);
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByRole("button", { name: /Google로/ })).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /카카오로/ })).not.toBeInTheDocument();
  expect(screen.queryByText("준비 중")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "이메일로 계속하기" })).toBeEnabled();
});

it("starts OAuth once and preserves the requested action", async () => {
  availableSocialProviders.mockResolvedValue(["google", "kakao"]);
  startSocialLogin.mockReturnValue(new Promise(() => {}));
  render(<MemoryRouter initialEntries={["/login?next=%2Fcreate%3Ftype%3DTASK"]}><LoginPage /></MemoryRouter>);
  const button = screen.getByRole("button", { name: /Google로/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button); fireEvent.click(button);
  expect(startSocialLogin).toHaveBeenCalledTimes(1);
  expect(startSocialLogin).toHaveBeenCalledWith("google", "/create?type=TASK");
  expect(signIn).not.toHaveBeenCalled();
});

it("recovers from provider errors so another login can be attempted", async () => {
  availableSocialProviders.mockResolvedValue(["google"]);
  startSocialLogin.mockRejectedValue(new Error("network"));
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
  const button = screen.getByRole("button", { name: /Google로/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("간편 로그인에 연결하지 못했어요");
  expect(button).toBeEnabled();
});
