import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const REF = "wmznpuhqmmqunwtewntt";
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

const token = getAccessToken();
if (!token.startsWith("sbp_")) {
  throw new Error(`unexpected token prefix: ${token.slice(0, 6)}`);
}

const sql = readFileSync(
  "supabase/migrations/0016_reopen_demand_after_close.sql",
  "utf8",
);
const res = await fetch(URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});
const text = await res.text();
console.log(`[0016] HTTP ${res.status}`);
console.log(text.slice(0, 1200));
if (!res.ok) throw new Error(`0016 failed: ${text}`);

const verify = await fetch(URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: `
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'reopen_demand_after_trade_close';
`.trim(),
  }),
});
const verifyText = await verify.text();
console.log(`[VERIFY] HTTP ${verify.status}`);
console.log(verifyText.slice(0, 800));
if (!verify.ok) throw new Error(`verify failed: ${verifyText}`);
