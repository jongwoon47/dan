import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DanProvider } from "@/domain/store";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders the open-catalog DAN live-demand home", () => {
    render(<DanProvider><MemoryRouter><HomePage /></MemoryRouter></DanProvider>);
    expect(screen.getByRole("heading",{ name:"찾는 물건이 있나요?" })).toBeInTheDocument();
    expect(screen.getByText("iPhone 15 Pro")).toBeInTheDocument();
    expect(screen.getByRole("button",{ name:/전자기기/ })).toBeInTheDocument();
    expect(screen.queryByRole("link",{ name:/내 구매수요/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link",{ name:/전체 실시간 수요 보기/ })).toHaveAttribute("href","/feed");
    expect(screen.getByText(/전체 \d+/)).toBeInTheDocument();
  });
});
