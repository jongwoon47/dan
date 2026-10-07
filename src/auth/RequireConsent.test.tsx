import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { RequireConsent } from "./RequireConsent";

let authStatus: "loading" | "authenticated" | "anonymous" = "authenticated";
let resolution: "loading" | "required" | "satisfied" | "anonymous" = "required";

vi.mock("./AuthProvider", () => ({
  useAuth: () => ({ mode: "supabase", status: authStatus }),
}));
vi.mock("./ConsentProvider", async () => {
  const actual = await vi.importActual<typeof import("./ConsentProvider")>(
    "./ConsentProvider",
  );
  return {
    ...actual,
    useConsent: () => ({
      resolution,
      record: null,
      error: null,
      accept: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

afterEach(() => {
  cleanup();
  authStatus = "authenticated";
  resolution = "required";
});

function show(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/consent" element={<div>consent-screen</div>} />
        <Route element={<RequireConsent />}>
          <Route path="/" element={<div>app-home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

it("redirects authenticated users without current consent", () => {
  show("/");
  expect(screen.getByText("consent-screen")).toBeInTheDocument();
  expect(screen.queryByText("app-home")).not.toBeInTheDocument();
});

it("skips consent when versions are satisfied", () => {
  resolution = "satisfied";
  show("/");
  expect(screen.getByText("app-home")).toBeInTheDocument();
});

it("allows anonymous browsing without consent", () => {
  authStatus = "anonymous";
  resolution = "anonymous";
  show("/");
  expect(screen.getByText("app-home")).toBeInTheDocument();
});

it("holds a loading shell instead of flashing app chrome", () => {
  resolution = "loading";
  show("/");
  expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
  expect(screen.queryByText("app-home")).not.toBeInTheDocument();
  expect(screen.queryByText("consent-screen")).not.toBeInTheDocument();
});
