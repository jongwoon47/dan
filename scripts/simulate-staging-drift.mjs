#!/usr/bin/env node
/**
 * Local simulation of staging schema drift — NO staging / production write.
 *
 * Confirmed staging assumptions (2026-10-09):
 * - Ledger tip: 20261006054157 (account_deletion)
 * - Consent objects already present (applied out-of-band or under alternate
 *   ledger names) — repo consent migrations use IF NOT EXISTS / CREATE OR REPLACE
 * - Market columns, nearby RPCs, JP pilot control missing
 *
 * Usage:
 *   node scripts/simulate-staging-drift.mjs
 *   SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     node scripts/simulate-staging-drift.mjs
 *
 * Behavior:
 * - Refuses non-localhost DB URLs (never targets remote staging/prod).
 * - When a local DB + psql (or dockerized psql) is available: optionally
 *   simulates consent-without-ledger, then applies forward migrations
 *   20261007..20261009130000 and records ledger versions.
 * - When docker/supabase/psql are unavailable: exits 0 with SKIP + dry-run
 *   checklist (safe for CI verify without Docker DB).
 *
 * See docs/STAGING_DRIFT_RECONCILIATION_20261009.md
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");

const STAGING_LEDGER_TIP = "20261006054157";

/** Keep in sync with src/lib/stagingDriftPlan.ts */
const FORWARD_MIGRATIONS = [
  "20261007000000_user_consents.sql",
  "20261008000000_consent_server_authority.sql",
  "20261009000000_private_nearby_discovery.sql",
  "20261009010000_market_country_currency.sql",
  "20261009120000_market_partition_hardening.sql",
  "20261009130000_jp_pilot_region_control.sql",
];

const LOCAL_DEFAULT_URL =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function versionOf(filename) {
  return filename.replace(/_.*$/, "").replace(/\.sql$/, "");
}

function isLocalDbUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function portOpen(host, port, timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok) => {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function hasCommand(bin) {
  try {
    execFileSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function printDryRunChecklist(reason) {
  console.log("SKIP: staging drift local simulation (no local DB apply).");
  console.log(`Reason: ${reason}`);
  console.log("");
  console.log("=== Dry-run checklist (no writes) ===");
  console.log(`Assumptions:`);
  console.log(`  - Ledger tip: ${STAGING_LEDGER_TIP}`);
  console.log(`  - Preexisting consent objects (user_consents / RPCs)`);
  console.log(`  - Missing market columns + nearby/JP pilot migrations`);
  console.log("");
  console.log("Forward apply order (AFTER owner approval on staging):");
  for (const [i, file] of FORWARD_MIGRATIONS.entries()) {
    console.log(`  ${i + 1}. ${file}`);
  }
  console.log("");
  console.log("Local verification steps when Docker + Supabase CLI available:");
  console.log("  1. supabase start && supabase db reset");
  console.log("  2. supabase test db   # includes staging_drift_forward.sql");
  console.log(
    "  3. SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \\",
  );
  console.log("       node scripts/simulate-staging-drift.mjs");
  console.log("");
  console.log("Filesystem asserts (always runnable):");
  console.log("  npx vitest run src/lib/stagingDriftPlan.test.ts");
  console.log("");
  console.log(
    "Post-apply probes: market columns present; jp_market_writes_allowed() = false;",
  );
  console.log("  list_pilot_regions exists. See docs/STAGING_DRIFT_RECONCILIATION_20261009.md");
}

function resolvePsqlRunner() {
  if (hasCommand("psql")) {
    return { kind: "psql", bin: "psql" };
  }
  if (hasCommand("docker")) {
    // Use official client image against host network (local supabase on 54322).
    return { kind: "docker-psql", image: "postgres:16" };
  }
  return null;
}

function runSql(runner, dbUrl, sql, label) {
  if (runner.kind === "psql") {
    const result = spawnSync(
      runner.bin,
      [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      throw new Error(
        `${label} failed: ${result.stderr || result.stdout || "psql error"}`,
      );
    }
    return (result.stdout || "").trim();
  }

  const result = spawnSync(
    "docker",
    [
      "run",
      "--rm",
      "--network",
      "host",
      "-i",
      runner.image,
      "psql",
      dbUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "-",
    ],
    { encoding: "utf8", input: sql },
  );
  if (result.status !== 0) {
    throw new Error(
      `${label} failed: ${result.stderr || result.stdout || "docker psql error"}`,
    );
  }
  return (result.stdout || "").trim();
}

function applyMigrationFile(runner, dbUrl, filename) {
  const full = path.join(migrationsDir, filename);
  if (!existsSync(full)) {
    throw new Error(`missing migration file: ${filename}`);
  }
  const sql = readFileSync(full, "utf8");
  const version = versionOf(filename);
  const name = filename.replace(/\.sql$/, "");
  // Apply DDL then record ledger (idempotent insert).
  const wrapped = `
begin;
${sql}
insert into supabase_migrations.schema_migrations (version, name)
values ('${version}', '${name}')
on conflict (version) do nothing;
commit;
`;
  runSql(runner, dbUrl, wrapped, filename);
  console.log(`Applied: ${filename}`);
}

async function simulateConsentWithoutLedger(runner, dbUrl) {
  // Staging-shaped state: tip at account_deletion, consent table present,
  // but 20261007/08 may be absent from the ledger.
  const tipSql = `
select coalesce(
  (select max(version) from supabase_migrations.schema_migrations),
  ''
) as tip;
`;
  const tipOut = runSql(runner, dbUrl, tipSql, "ledger tip");
  console.log(`Current ledger tip probe:\n${tipOut}`);

  const ensureConsent = `
do $$
begin
  if to_regclass('public.user_consents') is null then
    -- Minimal stand-in for out-of-band consent presence before forward apply.
    -- Full shape comes from 20261007000000 (IF NOT EXISTS) when applied.
    create table public.user_consents (
      user_id uuid primary key,
      terms_version text not null,
      privacy_version text not null,
      terms_accepted_at timestamptz not null,
      privacy_accepted_at timestamptz not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;
`;
  runSql(runner, dbUrl, ensureConsent, "simulate consent-without-ledger");
  console.log(
    "Simulated consent-without-ledger (user_consents present; forward consent migrations remain idempotent).",
  );
}

async function main() {
  console.log("simulate-staging-drift: local only (refuses remote staging write)");
  console.log(`Documented tip: ${STAGING_LEDGER_TIP}`);
  console.log(`Forward migrations: ${FORWARD_MIGRATIONS.length}`);

  const envUrl = process.env.SUPABASE_DB_URL?.trim() || "";
  let dbUrl = envUrl;

  if (envUrl && !isLocalDbUrl(envUrl)) {
    console.error(
      "REFUSED: SUPABASE_DB_URL is not localhost. This script never writes remote staging/production.",
    );
    process.exit(2);
  }

  if (!dbUrl) {
    const localUp = await portOpen("127.0.0.1", 54322);
    if (localUp) {
      dbUrl = LOCAL_DEFAULT_URL;
      console.log(`Detected local Supabase Postgres on 54322 → ${dbUrl}`);
    } else {
      // Optional isolated drift sandbox (not a substitute for full supabase reset).
      const sandboxUp = await portOpen("127.0.0.1", 54333);
      if (sandboxUp) {
        dbUrl =
          "postgresql://postgres:postgres@127.0.0.1:54333/postgres";
        console.log(
          `Detected local Postgres sandbox on 54333 → ${dbUrl} (forward apply only; needs preexisting schemas)`,
        );
      }
    }
  }

  const runner = resolvePsqlRunner();
  const dockerOk = hasCommand("docker");
  const supabaseCli = hasCommand("supabase");

  if (!dbUrl || !runner) {
    const reasons = [];
    if (!dbUrl) {
      reasons.push(
        "no SUPABASE_DB_URL and nothing listening on 127.0.0.1:54322",
      );
    }
    if (!runner) {
      reasons.push("neither psql nor docker available for SQL apply");
    }
    if (!dockerOk) reasons.push("docker missing");
    if (!supabaseCli) reasons.push("supabase CLI missing");
    printDryRunChecklist(reasons.join("; "));
    process.exit(0);
  }

  try {
    await simulateConsentWithoutLedger(runner, dbUrl);

    for (const file of FORWARD_MIGRATIONS) {
      const version = versionOf(file);
      const check = runSql(
        runner,
        dbUrl,
        `select exists(
           select 1 from supabase_migrations.schema_migrations
           where version = '${version}'
         ) as present;`,
        `ledger check ${version}`,
      );
      if (/\bt\b|\btrue\b/i.test(check.split("\n").pop() || "")) {
        console.log(`Skip (already in ledger): ${file}`);
        continue;
      }
      applyMigrationFile(runner, dbUrl, file);
    }

    const verify = `
select
  (select to_regclass('public.user_consents') is not null) as has_consents,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='demands'
       and column_name in ('country_code','currency_code')) as market_cols,
  (select to_regprocedure('public.list_pilot_regions(text)') is not null) as has_list_pilot,
  (select dan_private.jp_market_writes_allowed()) as jp_writes_allowed;
`;
    console.log("Verify:");
    console.log(runSql(runner, dbUrl, verify, "post-apply verify"));
    console.log("OK: local forward drift simulation complete.");
  } catch (err) {
    console.error(`FAIL: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
