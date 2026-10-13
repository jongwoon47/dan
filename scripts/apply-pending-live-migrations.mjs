/**
 * Apply the pending non-destructive live-DAN migrations with pre/post verify.
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN=sbp_…
 *   VITE_SUPABASE_URL=https://wmznpuhqmmqunwtewntt.supabase.co
 *   VITE_SUPABASE_ANON_KEY=… (publishable)
 *   DAN_ENV=staging|production
 *   DAN_REMOTE_CONFIRM=apply-staging-only|apply-production-only
 *   DAN_STAGING_SUPABASE_PROJECT_REF=wmznpuhqmmqunwtewntt  (staging)
 *   or DAN_SUPABASE_PROJECT_REF=wmznpuhqmmqunwtewntt (production)
 *
 * Dry-run (no token / no apply):
 *   node scripts/apply-pending-live-migrations.mjs --plan
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { DAN_SUPABASE_PROJECT_REF } from "../src/release/environmentSeparation.ts";

const PLAN_ONLY = process.argv.includes("--plan");

const FILES = [
  "supabase/migrations/20261009000000_private_nearby_discovery.sql",
  "supabase/migrations/20261009010000_market_country_currency.sql",
  "supabase/migrations/20261009120000_market_partition_hardening.sql",
  "supabase/migrations/20261009130000_jp_pilot_region_control.sql",
  "supabase/migrations/20261013000000_apple_profile_display_name.sql",
];

const SAFETY = {
  dataLossRisk: "none-expected",
  notes: [
    "ADD COLUMN country_code/currency_code DEFAULT KR/KRW — preserves all demand rows",
    "CREATE OR REPLACE RPCs / IF NOT EXISTS tables — no row deletes",
    "20261009120000 UPDATEs unlocked deal_snapshots.currency_code to KRW default only",
    "Apple migration only replaces handle_new_user(); existing profiles untouched",
    "Rollback: forward-only preferred; DROP COLUMN would be destructive and needs approval",
  ],
};

console.log(
  JSON.stringify(
    {
      target: DAN_SUPABASE_PROJECT_REF,
      planOnly: PLAN_ONLY,
      files: FILES,
      safety: SAFETY,
    },
    null,
    2,
  ),
);

for (const file of FILES) {
  if (!existsSync(file)) {
    console.error("Missing", file);
    process.exit(2);
  }
  const sql = readFileSync(file, "utf8");
  if (/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(sql)) {
    console.error(`REFUSED: ${file} looks destructive — needs human approval`);
    process.exit(1);
  }
}

function runNode(args, env = process.env) {
  const r = spawnSync(process.execPath, args, {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  return r.status ?? 1;
}

console.log("\n=== PRE-VERIFY ===");
const pre = runNode(["scripts/verify-live-schema.mjs"]);
if (pre !== 0) {
  console.error("PRE-VERIFY failed (core consent/ownership prerequisites)");
  process.exit(pre);
}

if (PLAN_ONLY) {
  console.log(
    "\nPLAN ONLY — not applying. Set SUPABASE_ACCESS_TOKEN and remove --plan to apply.",
  );
  process.exit(0);
}

if (!process.env.SUPABASE_ACCESS_TOKEN?.startsWith("sbp_")) {
  console.error(
    "\nNEEDS USER: SUPABASE_ACCESS_TOKEN (sbp_…) required to apply. Migrations are ready and non-destructive.",
  );
  process.exit(2);
}

console.log("\n=== APPLY ===");
const apply = runNode(["scripts/apply-sql-remote.mjs", ...FILES]);
if (apply !== 0) process.exit(apply);

console.log("\n=== POST-VERIFY (--expect-market) ===");
const post = runNode(["scripts/verify-live-schema.mjs", "--expect-market"]);
if (post !== 0) {
  console.error("POST-VERIFY failed after apply");
  process.exit(post);
}
console.log("\nApplied and verified on", DAN_SUPABASE_PROJECT_REF);
