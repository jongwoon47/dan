import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ko } from "@/copy/ko";
import { DanProvider } from "@/domain/store";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders demand-first hero and CTAs", () => {
    render(
      <DanProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </DanProvider>,
    );

    expect(screen.getByRole("heading", { name: ko.heroTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ko.ctaCreate })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ko.ctaBrowse })).toBeInTheDocument();
    expect(screen.getByText(ko.featuredTitle)).toBeInTheDocument();
    expect(screen.getAllByText("31").length).toBeGreaterThan(0);
  });
});
