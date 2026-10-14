import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ShellChromeProvider } from "@/components/layout/ShellChrome";
import { NotFoundPage } from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("shows an explicit recovery path for unknown URLs", () => {
    render(
      <MemoryRouter>
        <ShellChromeProvider>
          <NotFoundPage />
        </ShellChromeProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "페이지를 찾을 수 없어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
