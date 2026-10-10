import { getDataMode } from "@/data/mode";
import { getSupabase } from "@/data/supabase/client";
import type { MarketCountry } from "@/lib/marketPrefs";

export type PilotRegion = {
  regionKey: string;
  enabled: boolean;
  note: string | null;
};

type RpcPilotRegionRow = {
  region_key?: unknown;
  enabled?: unknown;
  note?: unknown;
};

function mapRow(row: RpcPilotRegionRow): PilotRegion | null {
  const regionKey = typeof row.region_key === "string" ? row.region_key.trim() : "";
  if (!regionKey) return null;
  return {
    regionKey,
    enabled: row.enabled === true,
    note: typeof row.note === "string" ? row.note : null,
  };
}

/**
 * Authenticated list of enabled pilot regions for browse UI notes.
 * Demo mode and RPC failures return [] — never invent live inventory.
 */
export async function listPilotRegions(country: MarketCountry): Promise<PilotRegion[]> {
  if (getDataMode() !== "supabase") return [];
  try {
    const { data, error } = await getSupabase().rpc("list_pilot_regions", {
      p_country: country,
    });
    if (error || !Array.isArray(data)) return [];
    return data
      .map((row) => mapRow(row as RpcPilotRegionRow))
      .filter((row): row is PilotRegion => row != null);
  } catch {
    return [];
  }
}
