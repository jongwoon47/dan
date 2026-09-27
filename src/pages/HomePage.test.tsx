import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { DanProvider } from "@/domain/store";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders the DAN V1 live-demand camera home", () => {
    render(
      <DanProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </DanProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: /찾아서 사는 게 아니라.*사고 싶다고 먼저 말해요/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "지금 사고 있는 사람들" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fujifilm X100VI")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "구매수요 등록하기" }),
    ).toHaveAttribute("href", "/buy/new");
  });
});
