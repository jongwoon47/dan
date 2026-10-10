import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { ProfilePage } from "./ProfilePage";

const updateMyProfile = vi.fn(async () => null);

vi.mock("@/components/layout/ShellChrome", () => ({
  useDeepHeader: vi.fn(),
}));

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    currentUser: { id: "u1", name: "나" },
    busy: false,
    myMatches: [],
    getProduct: vi.fn(),
    getDemand: vi.fn(),
    blockUser: vi.fn(),
    reportUser: vi.fn(),
    logout: vi.fn(),
    getPublicProfile: vi.fn(async () => ({
      id: "u1",
      displayName: "나",
      defaultArea: "성동구",
      bio: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      completedDemandCount: 0,
      responseConnectionCount: 0,
      identityVerified: false,
      unresolvedDisputeCount: 0,
      sellerFaultCancellationCount: 0,
      buyerFaultCancellationCount: 0,
      confirmedMismatchCount: 0,
    })),
    updateMyProfile,
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
  updateMyProfile.mockClear();
});

it("announces profile save failure with role=alert", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/profile/u1"]}>
      <Routes>
        <Route path="/profile/:userId" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByRole("button", { name: "프로필 수정" });
  await user.click(screen.getByRole("button", { name: "프로필 수정" }));
  await user.click(screen.getByRole("button", { name: "프로필 저장" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("잠시 후 다시 시도해 주세요.");
  expect(updateMyProfile).toHaveBeenCalled();
});
