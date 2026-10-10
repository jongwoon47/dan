import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("exposes a polite status region labelled by the title", () => {
    render(
      <EmptyState
        title="아직 대화가 없어요"
        body="요청이 연결되면 여기에서 대화를 이어가요."
      />,
    );

    const region = screen.getByRole("status", { name: "아직 대화가 없어요" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByRole("heading", { level: 2, name: "아직 대화가 없어요" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("요청이 연결되면 여기에서 대화를 이어가요."),
    ).toBeInTheDocument();
  });

  it("supports headingLevel 3 under existing section titles", () => {
    render(<EmptyState headingLevel={3} title="요청이 없어요" />);
    expect(
      screen.getByRole("heading", { level: 3, name: "요청이 없어요" }),
    ).toBeInTheDocument();
  });
});
