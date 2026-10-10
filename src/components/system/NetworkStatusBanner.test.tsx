import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NetworkStatusBanner } from "./NetworkStatusBanner";

const originalOnline = navigator.onLine;

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

afterEach(() => {
  setOnline(originalOnline);
});

describe("NetworkStatusBanner", () => {
  it("appears offline and disappears after connectivity returns", () => {
    setOnline(false);
    render(<NetworkStatusBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("오프라인이에요");

    act(() => setOnline(true));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
