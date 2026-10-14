/**
 * Apply one or more SQL files to the live DAN Supabase project.
 *
 * Paths (in order):
 *   1) SUPABASE_ACCESS_TOKEN (sbp_…) → Management API /database/query
 *   2) SUPABASE_DB_URL / DATABASE_URL → psql -v ON_ERROR_STOP=1
 *
 * Both paths refuse retired refs and destructive DROP TABLE/TRUNCATE/DELETE.
 * After each successful file, records supabase_migrations.schema_migrations
 * so the ledger stays consistent with the repo filenames.
 *
 * Example (psql path):
 *   DAN_ENV=staging \
 *   DAN_REMOTE_CONFIRM=apply-staging-only \
 *   DAN_STAGING_SUPABASE_PROJECT_REF=wmznpuhqmmqunwtewntt \
 *   SUPABASE_DB_URL=postgresql://… \
 *   node scripts/apply-sql-remote.mjs supabase/migrations/20261009010000_….sql
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { assertRemoteMigrationAllowed } from "../src/release/remoteDbTargetGuard.ts";
import {
  DAN_SUPABASE_PROJECT_REF,
  RETIRED_SUPABASE_PROJECT_REFS,
} from "../src/release/environmentSeparation.ts";

const decision = assertRemoteMigrationAllowed(process.env);
if (!decision.ok) {
  console.error(decision.message);
  process.exit(decision.code);
}

const REF = decision.projectRef ?? "";
if (!REF || REF !== DAN_SUPABASE_PROJECT_REF) {
  console.error(
    `REFUSED: only the live DAN project ${DAN_SUPABASE_PROJECT_REF} may be targeted.`,
  );
  process.exit(1);
}
if (RETIRED_SUPABASE_PROJECT_REFS.some((retired) => REF.includes(retired))) {
  console.error("REFUSED: retired Supabase project.");
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/apply-sql-remote.mjs <file.sql> [more.sql…]");
  process.exit(2);
}

for (const file of files) {
  if (!existsSync(file)) {
    console.error(`Missing file: ${file}`);
    process.exit(2);
  }
  const sql = readFileSync(file, "utf8");
  if (/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(sql)) {
    console.error(
      `REFUSED: ${file} looks destructive (DROP/TRUNCATE/DELETE). Needs human approval.`,
    );
    process.exit(1);
  }
}

function dbUrl() {
  return (
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.STAGING_SUPABASE_DB_URL?.trim() ||
    ""
  );
}

function assertDbUrlTargetsLive(url) {
  const lower = url.toLowerCase();
  if (!lower.includes(DAN_SUPABASE_PROJECT_REF)) {
    console.error(`REFUSED: DB URL must target ${DAN_SUPABASE_PROJECT_REF}`);
    process.exit(1);
  }
  if (RETIRED_SUPABASE_PROJECT_REFS.some((r) => lower.includes(r))) {
    console.error("REFUSED: retired Supabase project in DB URL");
    process.exit(1);
  }
}

function migrationVersionName(file) {
  const base = path.basename(file, ".sql");
  const m = base.match(/^(\d+)(?:_(.+))?$/);
  if (!m) {
    throw new Error(`Cannot parse migration version from ${base}`);
  }
  return { version: m[1], name: m[2] ?? base };
}

function ledgerSql(file) {
  const { version, name } = migrationVersionName(file);
  // Keep ledger consistent with `supabase db push` / CLI without rewriting history.
  return `
insert into supabase_migrations.schema_migrations (version, name)
values ('${version}', '${name.replace(/'/g, "''")}')
on conflict (version) do update set name = excluded.name;
`;
}

function getAccessToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? "";
  if (fromEnv) return fromEnv;
  if (process.platform !== "win32") return "";
  const ps1 = `
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;using System.Text;
public class CredY {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags; public uint Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob; public uint Persist;
    public uint AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr cred);
  public static string Get() {
    IntPtr p;
    if (!CredRead("Supabase CLI:supabase", 1, 0, out p)) return "";
    var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
    byte[] bytes = new byte[c.CredentialBlobSize];
    Marshal.Copy(c.CredentialBlob, bytes, 0, (int)c.CredentialBlobSize);
    CredFree(p);
    int len = bytes.Length; while (len > 0 && bytes[len-1]==0) len--;
    return Encoding.UTF8.GetString(bytes, 0, len);
  }
}
"@
[CredY]::Get()
`;
  const tmp = path.resolve("scripts/_tmp_get_token.ps1");
  writeFileSync(tmp, ps1, "utf8");
  try {
    return execFileSync(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmp],
      { encoding: "utf8" },
    ).trim();
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

async function runViaManagementApi(token, sql, label) {
  const endpoint = `https://api.supabase.com/v1/projects/${REF}/database/query`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log(`[${label}] HTTP ${res.status}`);
  console.log(text.slice(0, 1500));
  if (!res.ok) throw new Error(`${label} failed`);
}

function runViaPsql(url, sql, label) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "dan-sql-"));
  const file = path.join(dir, `${label}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    // Never print connection string. ON_ERROR_STOP aborts the file on first error.
    execFileSync(
      "psql",
      [url, "-v", "ON_ERROR_STOP=1", "-f", file, "-q"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PGPASSWORD: undefined },
      },
    );
    console.log(`[${label}] psql OK`);
  } catch (e) {
    const err = e.stderr || e.message || String(e);
    // Redact any accidental URI fragments from psql errors.
    const scrubbed = String(err).replace(/postgresql:\/\/[^\s]+/gi, "postgresql://[redacted]");
    console.error(`[${label}] psql FAILED`);
    console.error(scrubbed.slice(0, 2000));
    throw new Error(`${label} failed`);
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

const token = getAccessToken();
const url = dbUrl();
const mode = token.startsWith("sbp_")
  ? "management-api"
  : url
    ? "psql"
    : null;

if (!mode) {
  console.error(
    "NEEDS USER: set SUPABASE_ACCESS_TOKEN (sbp_…) or SUPABASE_DB_URL for apply.",
  );
  process.exit(2);
}

if (mode === "psql") {
  assertDbUrlTargetsLive(url);
  console.log(`Apply path: psql → ${REF}`);
} else {
  console.log(`Apply path: management-api → ${REF}`);
}

for (const file of files) {
  const label = path.basename(file);
  // Single transaction: DDL + ledger row, or neither (no silent history skew).
  const body = `begin;\n${readFileSync(file, "utf8")}\n\n-- ledger\n${ledgerSql(file)}\ncommit;\n`;
  if (mode === "management-api") {
    await runViaManagementApi(token, body, label);
  } else {
    runViaPsql(url, body, label);
  }
}

console.log("Applied", files.length, "file(s) to", REF, `via ${mode}`);
