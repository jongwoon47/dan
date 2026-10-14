import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDan } from "@/domain/danContext";
import { SupabaseDanProvider } from "@/domain/store.supabase";

vi.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: null,
    status: "anonymous" as const,
    mode: "supabase" as const,
  }),
}));

vi.mock("@/data/supabase/api", () => ({
  listProducts: async () => [],
  listActiveDemands: async () => [],
  listBuyAggregates: async () => [],
}));

describe("supabase payment boundary", () => {
  it("refuses the demo payment simulation", async () => {
    const { result } = renderHook(() => useDan(), {
      wrapper: SupabaseDanProvider,
    });
    await waitFor(() => {
      expect(result.current.simulateSafePaymentDemo).toEqual(expect.any(Function));
    });
    await expect(result.current.simulateSafePaymentDemo("any-match")).resolves.toBe(false);
  });
});
