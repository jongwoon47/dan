import { Component, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

class Boom extends Component<{ children?: ReactNode }> {
  render(): ReactNode {
    throw new Error("boom");
  }
}

describe("AppErrorBoundary", () => {
  it("replaces a render crash with a recoverable user-facing fallback", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "화면을 불러오지 못했어요" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다시 불러오기" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "홈으로" })).toBeInTheDocument();

    spy.mockRestore();
  });
});
