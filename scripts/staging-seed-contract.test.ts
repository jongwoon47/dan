import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("staging Live Demand seed contract", () => {
  it("phone-verifies the synthetic seed profile before inserting visible BUY demand", () => {
    const sql = readFileSync(
      path.join(root, "supabase/seeds/staging_live_demands.sql"),
      "utf8",
    );
    const verification = sql.indexOf("insert into public.user_verifications");
    const demand = sql.indexOf("insert into public.demands");

    expect(verification).toBeGreaterThan(-1);
    expect(demand).toBeGreaterThan(verification);
    expect(sql).toContain("phone_verified_at");
    expect(sql).not.toContain("identity_verified_at");
    expect(sql).not.toContain("payout_verified_at");
  });
});
