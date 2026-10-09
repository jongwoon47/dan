/**
 * Apply consent migrations to staging only.
 * DAN_ENV=staging DAN_REMOTE_CONFIRM=apply-staging-only
 * DAN_STAGING_SUPABASE_PROJECT_REF=wmznpuhqmmqunwtewntt
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { assertRemoteMigrationAllowed } from "../src/release/remoteDbTargetGuard.ts";

const decision = assertRemoteMigrationAllowed(process.env);
if (!decision.ok) {
  console.error(decision.message);
  process.exit(decision.code);
}

const REF = decision.projectRef ?? "";
const URL = `https://api.supabase.com/v1/projects/${REF}/database/query`;

function getAccessToken() {
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

async function runSql(sql, label) {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  console.log(`[${label}] HTTP ${res.status}`);
  console.log(text.slice(0, 1200));
  if (!res.ok) throw new Error(`${label} failed: ${text}`);
}

const token = getAccessToken();
if (!token.startsWith("sbp_")) {
  throw new Error(`unexpected token prefix: ${token.slice(0, 6)}`);
}

const files = [
  "supabase/migrations/20261007000000_user_consents.sql",
  "supabase/migrations/20261009000000_consent_server_authority.sql",
];

for (const file of files) {
  await runSql(readFileSync(file, "utf8"), path.basename(file));
}

await runSql(
  `
select to_regclass('public.user_consents') as user_consents,
       to_regclass('public.consent_requirements') as consent_requirements,
       (select terms_version || '/' || privacy_version from public.consent_requirements where singleton) as versions,
       (select proname from pg_proc where proname = 'accept_my_consents') as accept_fn,
       (select proname from pg_proc where proname = 'get_consent_requirements') as req_fn;
`.trim(),
  "VERIFY",
);

console.log("Consent migrations applied.");
