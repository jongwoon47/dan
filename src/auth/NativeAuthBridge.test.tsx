import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NativeAuthBridge } from "./NativeAuthBridge";

const { navigate, exchange, listeners, close, getLaunchUrl } = vi.hoisted(() => ({
  navigate: vi.fn(), exchange: vi.fn(), close: vi.fn(), getLaunchUrl: vi.fn(),
  listeners: new Map<string, (event: { url: string }) => void>(),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/app", () => ({ App: {
  getLaunchUrl,
  addListener: async (event: string, callback: (data: { url: string }) => void) => {
    listeners.set(event, callback); return { remove: async () => { listeners.delete(event); } };
  },
} }));
vi.mock("@capacitor/browser", () => ({ Browser: { close, addListener: async () => ({ remove: vi.fn() }) } }));
vi.mock("@/data/supabase/client", () => ({ getSupabase: () => ({ auth: { exchangeCodeForSession: exchange } }) }));
beforeEach(() => { getLaunchUrl.mockResolvedValue(undefined); exchange.mockResolvedValue({ error: null }); close.mockResolvedValue(undefined); sessionStorage.clear(); });
afterEach(() => { cleanup(); listeners.clear(); vi.clearAllMocks(); });

it("restores a cold-launch session once and returns to the requested action", async () => {
  const url = "dan-staging://auth/callback?code=test-code";
  sessionStorage.setItem("dan-native-login-next", "/create?type=TASK");
  getLaunchUrl.mockResolvedValue({ url });
  render(<NativeAuthBridge />);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login?next=%2Fcreate%3Ftype%3DTASK", { replace: true }));
  listeners.get("appUrlOpen")!({ url });
  expect(exchange).toHaveBeenCalledTimes(1);
  expect(exchange).toHaveBeenCalledWith("test-code");
});

it("rejects foreign deep links and reports failed code exchange without exposing its details", async () => {
  sessionStorage.setItem("dan-native-login-next", "/\\evil.example");
  exchange.mockResolvedValue({ error: new Error("private provider detail") });
  render(<NativeAuthBridge />);
  await waitFor(() => expect(listeners.has("appUrlOpen")).toBe(true));
  listeners.get("appUrlOpen")!({ url: "https://evil.example/callback?code=x" });
  expect(exchange).not.toHaveBeenCalled();
  listeners.get("appUrlOpen")!({ url: "dan-staging://auth/callback?code=expired" });
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/login?next=%2Fmy&error=oauth_failed", { replace: true }));
});
