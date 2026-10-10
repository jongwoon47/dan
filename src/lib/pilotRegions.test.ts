import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDataMode, getSupabase } = vi.hoisted(() => ({
  getDataMode: vi.fn((): "demo" | "supabase" => "demo"),
  getSupabase: vi.fn(),
}));

vi.mock("@/data/mode", () => ({ getDataMode }));
vi.mock("@/data/supabase/client", () => ({ getSupabase }));

import { listPilotRegions } from "./pilotRegions";

describe("listPilotRegions", () => {
  beforeEach(() => {
    getDataMode.mockReset();
    getSupabase.mockReset();
  });

  it("returns empty in demo mode without calling supabase", async () => {
    getDataMode.mockReturnValue("demo");
    await expect(listPilotRegions("JP")).resolves.toEqual([]);
    expect(getSupabase).not.toHaveBeenCalled();
  });

  it("maps RPC rows and falls back to empty on error", async () => {
    getDataMode.mockReturnValue("supabase");
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { region_key: "fukuoka-hakata", enabled: true, note: "Browse-only" },
        { region_key: " ", enabled: true, note: null },
      ],
      error: null,
    });
    getSupabase.mockReturnValue({ rpc });
    await expect(listPilotRegions("JP")).resolves.toEqual([
      { regionKey: "fukuoka-hakata", enabled: true, note: "Browse-only" },
    ]);

    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listPilotRegions("JP")).resolves.toEqual([]);
  });
});
