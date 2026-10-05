import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DanProvider } from "@/domain/store";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders the open-catalog DAN live-demand home", () => {
    render(<DanProvider><MemoryRouter><HomePage /></MemoryRouter></DanProvider>);
    expect(screen.getByRole("heading", { name: /무엇이 필요하세요\?/ })).toBeInTheDocument();
    expect(screen.getByText("iPhone 15 Pro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /구매.*사고 싶은 물건/ })).toHaveAttribute("href", "/create?type=BUY");
    expect(screen.getByRole("link", { name: /빌리기.*잠깐 필요한 물건/ })).toHaveAttribute("href", "/create?type=BORROW");
    expect(screen.getByRole("link", { name: /심부름.*대신 해줄 일/ })).toHaveAttribute("href", "/create?type=TASK");
    expect(screen.getByRole("link", { name: /서비스.*전문적인 도움/ })).toHaveAttribute("href", "/create?type=SERVICE");
    expect(screen.getByRole("link", { name: "전체보기" })).toHaveAttribute("href", "/feed");
  });
});
