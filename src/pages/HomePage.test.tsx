import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DanProvider } from "@/domain/store";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders the four-type request-first DAN home", () => {
    render(<DanProvider><MemoryRouter><HomePage /></MemoryRouter></DanProvider>);
    expect(screen.getByRole("heading",{ name:"무엇이 필요하세요?" })).toBeInTheDocument();
    expect(screen.getByText("iPhone 15 Pro")).toBeInTheDocument();
    expect(screen.getByRole("button",{ name:/전자기기/ })).toBeInTheDocument();
    expect(screen.getByRole("link",{ name:/심부름/ })).toHaveAttribute("href","/create?type=TASK");
    expect(screen.getByRole("link",{ name:/요청 탐색하기/ })).toHaveAttribute("href","/feed");
    expect(screen.getByText(/전체 \d+/)).toBeInTheDocument();
  });
});
