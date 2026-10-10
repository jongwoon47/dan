import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShellChromeProvider } from "@/components/layout/ShellChrome";
import { DemandDetailPage } from "./DemandDetailPage";

vi.mock("@/domain/danContext", () => ({
  useDan: () => ({
    getProduct: () => undefined,
    getAggregate: () => undefined,
    myOwnerships: [],
    myDemands: [],
    currentUser: null,
    state: { demands: [] },
  }),
}));

afterEach(cleanup);

describe("DemandDetailPage missing product", () => {
  it("offers a primary browse recovery CTA", () => {
    render(
      <ShellChromeProvider>
        <MemoryRouter initialEntries={["/demand/missing"]}>
          <Routes>
            <Route path="/demand/:productId" element={<DemandDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ShellChromeProvider>,
    );
    const cta = screen.getByRole("link", { name: "찾기" });
    expect(cta).toHaveAttribute("href", "/feed");
    expect(cta.className).not.toMatch(/secondary/);
  });
});
