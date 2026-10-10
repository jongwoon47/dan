import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellChromeProvider } from "@/components/layout/ShellChrome";
import { setDanLocale } from "@/i18n/locale";
import { ActivityPage } from "./ActivityPage";

vi.mock("@/data/mode", () => ({ getDataMode: () => "demo" }));
vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    isLoggedIn: true,
    login: vi.fn(),
    currentUser: { id: "u1" },
    activities: [],
    refreshActivities: vi.fn(async () => undefined),
    unreadActivityCount: 0,
    state: { responses: [] },
    getDemand: () => undefined,
    getPublicProfile: async () => null,
    markActivityRead: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
});

describe("ActivityPage empty state", () => {
  it("uses localized empty body copy with a primary browse CTA", async () => {
    render(
      <ShellChromeProvider>
        <MemoryRouter>
          <ActivityPage />
        </MemoryRouter>
      </ShellChromeProvider>,
    );
    await waitFor(() => {
      expect(
        screen.getByText("새 응답, 거래 진행, 메시지 알림이 이곳에 모여요."),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "찾기" })).toBeInTheDocument();
  });
});
