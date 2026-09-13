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
    expect(screen.getByText(ko.typeBuy)).toBeInTheDocument();
    expect(screen.getByText(ko.typeTask)).toBeInTheDocument();
    expect(screen.getByText(ko.feedNowTitle)).toBeInTheDocument();
  });
});
