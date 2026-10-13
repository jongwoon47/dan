/**
 * Apply one or more SQL files to the live DAN Supabase project via Management API.
 *
 * Prefer SUPABASE_ACCESS_TOKEN in the environment (sbp_…). Falls back to the
 * Windows CredMan helper used by older apply scripts.
 *
 * Example:
 *   DAN_ENV=staging \
 *   DAN_REMOTE_CONFIRM=apply-staging-only \
 *   DAN_STAGING_SUPABASE_PROJECT_REF=wmznpuhqmmqunwtewntt \
 *   SUPABASE_ACCESS_TOKEN=sbp_… \
 *   node scripts/apply-sql-remote.mjs supabase/migrations/20261009010000_market_country_currency.sql
 *
 * Destructive deletes are refused. Files are applied in the given order.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
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

function getAccessToken() {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim() ?? "";
  if (fromEnv) return fromEnv;
  if (process.platform !== "win32") {
    throw new Error(
      "NEEDS USER: set SUPABASE_ACCESS_TOKEN (sbp_…) — Windows CredMan fallback is unavailable here.",
    );
  }
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

const token = getAccessToken();
if (!token.startsWith("sbp_")) {
  console.error("REFUSED: SUPABASE_ACCESS_TOKEN must be an sbp_ management token.");
  process.exit(2);
}

const endpoint = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSql(sql, label) {
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

for (const file of files) {
  await runSql(readFileSync(file, "utf8"), path.basename(file));
}

console.log("Applied", files.length, "file(s) to", REF);
