import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ko } from "@/copy/ko";
import { DanProvider } from "@/domain/store";
import { HomePage } from "@/pages/HomePage";

describe("HomePage", () => {
  it("renders composer-first home and mixed demand feed", () => {
    render(
      <DanProvider>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </DanProvider>,
    );

    expect(screen.getByRole("heading", { name: ko.composerTitle })).toBeInTheDocument();
    expect(screen.getAllByText(ko.typeBuy).length).toBeGreaterThan(0);
    expect(screen.getAllByText(ko.typeTask).length).toBeGreaterThan(0);
    expect(screen.getByText(ko.feedNowTitle)).toBeInTheDocument();
  });
});
