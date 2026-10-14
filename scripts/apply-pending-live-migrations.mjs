/**
 * Apply the pending non-destructive live-DAN migrations with pre/post verify.
 *
 * Requires a verified pg_dump backup first (Free plan has no auto backups):
 *   DAN_BACKUP_MANIFEST=/path/outside/repo/….manifest.json
 *   (from scripts/backup-live-dan-db.sh)
 *
 * Also requires:
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
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DAN_SUPABASE_PROJECT_REF } from "../src/release/environmentSeparation.ts";

const PLAN_ONLY = process.argv.includes("--plan");

function assertBackupManifest() {
  const manifestPath = process.env.DAN_BACKUP_MANIFEST?.trim() ?? "";
  if (!manifestPath) {
    return {
      ok: false,
      code: 2,
      message:
        "NEEDS USER: DAN_BACKUP_MANIFEST required. Run scripts/backup-live-dan-db.sh with SUPABASE_DB_URL first. Refusing migrate without backup.",
    };
  }
  if (!existsSync(manifestPath)) {
    return { ok: false, code: 2, message: `Missing manifest: ${manifestPath}` };
  }
  if (manifestPath.startsWith("/workspace/") || manifestPath.includes("/workspace/")) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: backup manifest must live outside the git worktree.",
    };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { ok: false, code: 1, message: "FAIL: manifest is not valid JSON" };
  }
  if (manifest.projectRef !== DAN_SUPABASE_PROJECT_REF) {
    return { ok: false, code: 1, message: "REFUSED: manifest projectRef mismatch" };
  }
  if (!manifest.dumpPath || !existsSync(manifest.dumpPath)) {
    return { ok: false, code: 1, message: "FAIL: dumpPath missing on disk" };
  }
  if (String(manifest.dumpPath).includes("/workspace/")) {
    return {
      ok: false,
      code: 1,
      message: "REFUSED: dump must not be inside the git worktree.",
    };
  }
  const bytes = readFileSync(manifest.dumpPath);
  if (!bytes.length) {
    return { ok: false, code: 1, message: "FAIL: dump is empty" };
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (manifest.sha256 && hash !== manifest.sha256) {
    return { ok: false, code: 1, message: "FAIL: dump sha256 mismatch vs manifest" };
  }
  if (!manifest.hasProfilesTableData) {
    return { ok: false, code: 1, message: "FAIL: manifest reports no profiles TABLE DATA" };
  }
  if ((manifest.tocEntries ?? 0) < 50) {
    return { ok: false, code: 1, message: "FAIL: manifest TOC too small" };
  }
  if (String(manifest.restoreProbe || "").startsWith("fail")) {
    return {
      ok: false,
      code: 1,
      message:
        "FAIL: restoreProbe failed — fix/restore-verify backup before migrate.",
    };
  }
  return {
    ok: true,
    code: 0,
    message: `Backup OK ${path.basename(manifest.dumpPath)} sha256=${hash.slice(0, 12)}…`,
  };
}

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
    "\nPLAN ONLY — not applying. After pg_dump backup, set DAN_BACKUP_MANIFEST + SUPABASE_ACCESS_TOKEN.",
  );
  process.exit(0);
}

const backup = assertBackupManifest();
console.log("\n=== BACKUP GATE ===");
console.log(backup.message);
if (!backup.ok) process.exit(backup.code);

const hasToken = process.env.SUPABASE_ACCESS_TOKEN?.startsWith("sbp_");
const hasDbUrl = Boolean(
  process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.STAGING_SUPABASE_DB_URL?.trim(),
);
if (!hasToken && !hasDbUrl) {
  console.error(
    "\nNEEDS USER: SUPABASE_ACCESS_TOKEN (sbp_…) or SUPABASE_DB_URL required to apply after backup.",
  );
  process.exit(2);
}
console.log(
  `\nApply credentials: ${hasToken ? "management-api token" : "psql via SUPABASE_DB_URL"}`,
);

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
