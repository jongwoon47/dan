import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { setDanLocale } from "@/i18n/locale";
import { CreateDemandPage } from "./CreateDemandPage";

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    products: [],
    createDemand: vi.fn(),
    ensureProduct: vi.fn(),
    currentUser: { id: "u1" },
    isLoggedIn: true,
  }),
}));

afterEach(() => {
  cleanup();
  setDanLocale("ko");
});

it("announces schedule form errors with role=alert on TASK create", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes>
        <Route path="/create" element={<CreateDemandPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("radio", { name: /심부름/ }));
  await user.type(screen.getByPlaceholderText("예: 평택역에서 짐 옮겨주세요"), "테스트 심부름");
  await user.type(screen.getByPlaceholderText("예: 20,000"), "10000");
  await user.click(screen.getByRole("button", { name: "다음" }));

  // REMOTE needs no place label — only schedule is missing so submit stays clickable.
  await user.click(screen.getByRole("button", { name: "온라인으로 하기" }));
  await user.click(screen.getByRole("button", { name: "요청하기" }));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("시간을 입력해 주세요.");
  expect(alert).toHaveClass("form-error");
});
