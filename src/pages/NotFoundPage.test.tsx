import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { ShellChromeProvider } from "@/components/layout/ShellChrome";
import { setDanLocale } from "@/i18n/locale";
import { NotFoundPage } from "./NotFoundPage";

afterEach(() => {
  cleanup();
  setDanLocale("ko");
});

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

  it("localizes not-found recovery for Japanese UI", () => {
    setDanLocale("ja");
    render(
      <MemoryRouter>
        <ShellChromeProvider>
          <NotFoundPage />
        </ShellChromeProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "ページが見つかりません" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ホームへ" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
