import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConsentPage } from "./ConsentPage";

const { accept, refresh } = vi.hoisted(() => ({
  accept: vi.fn(),
  refresh: vi.fn(),
}));
let resolution: "loading" | "required" | "satisfied" | "anonymous" | "error" =
  "required";
let loadError: string | null = null;

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ mode: "supabase", status: "authenticated" }),
}));
vi.mock("@/auth/ConsentProvider", async () => {
  const actual = await vi.importActual<typeof import("@/auth/ConsentProvider")>(
    "@/auth/ConsentProvider",
  );
  return {
    ...actual,
    useConsent: () => ({
      resolution,
      record: null,
      requirements: { termsVersion: "2026-10-07", privacyVersion: "2026-10-07" },
      error: loadError,
      accept,
      refresh,
    }),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  resolution = "required";
  loadError = null;
  accept.mockResolvedValue(undefined);
  refresh.mockResolvedValue(undefined);
});
afterEach(cleanup);

function show() {
  return render(
    <MemoryRouter initialEntries={["/consent?next=%2Fmy"]}>
      <Routes>
        <Route path="/consent" element={<ConsentPage />} />
        <Route path="/my" element={<div>home-ok</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

it("keeps CTA disabled until both required items are checked", () => {
  show();
  const cta = screen.getByRole("button", { name: "동의하고 시작하기" });
  expect(cta).toBeDisabled();

  fireEvent.click(screen.getByRole("checkbox", { name: /이용약관 동의/ }));
  expect(cta).toBeDisabled();

  fireEvent.click(screen.getByRole("checkbox", { name: /개인정보처리방침 동의/ }));
  expect(cta).toBeEnabled();
});

it("syncs all-consent with individual items", () => {
  show();
  const all = screen.getByRole("checkbox", { name: "전체 동의" });
  fireEvent.click(all);
  expect(all).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /이용약관 동의/ })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: /개인정보처리방침 동의/ })).toBeChecked();
  expect(screen.getByRole("button", { name: "동의하고 시작하기" })).toBeEnabled();

  fireEvent.click(screen.getByRole("checkbox", { name: /이용약관 동의/ }));
  expect(all).not.toBeChecked();
  expect(screen.getByRole("button", { name: "동의하고 시작하기" })).toBeDisabled();
});

it("enters the app only after a successful save", async () => {
  show();
  fireEvent.click(screen.getByRole("checkbox", { name: "전체 동의" }));
  fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));
  await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("home-ok")).toBeInTheDocument();
});

it("stays on consent and allows retry when save fails", async () => {
  accept.mockRejectedValue(new Error("offline"));
  show();
  fireEvent.click(screen.getByRole("checkbox", { name: "전체 동의" }));
  fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "동의 내용을 저장하지 못했어요",
  );
  expect(screen.queryByText("home-ok")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "동의하고 시작하기" })).toBeEnabled();

  accept.mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));
  expect(await screen.findByText("home-ok")).toBeInTheDocument();
});

it("shows status retry instead of the consent form when load fails", async () => {
  resolution = "error";
  loadError = "load";
  show();
  expect(screen.getByRole("alert")).toHaveTextContent("동의 상태를 확인하지 못했어요");
  expect(screen.queryByRole("checkbox", { name: "전체 동의" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
});

it("exposes real document links without toggling the row checkbox", () => {
  show();
  const termsView = screen.getByRole("link", { name: "이용약관 보기" });
  const privacyView = screen.getByRole("link", { name: "개인정보처리방침 보기" });
  expect(termsView).toHaveAttribute("href", expect.stringContaining("terms"));
  expect(privacyView).toHaveAttribute("href", expect.stringContaining("privacy"));
  fireEvent.click(termsView);
  expect(screen.getByRole("checkbox", { name: /이용약관 동의/ })).not.toBeChecked();
});

it("uses the compact auth consent shell classes for mobile layouts", () => {
  show();
  expect(document.querySelector(".consent-screen.auth-screen")).toBeTruthy();
  expect(document.querySelector(".consent-list")).toBeTruthy();
});
