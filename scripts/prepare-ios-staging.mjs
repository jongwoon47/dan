import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { assertStagingDeployAllowed } from "../src/release/stagingDeployGuard.ts";

const branch = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8" }).stdout.trim();
const env = { ...process.env };
const decision = assertStagingDeployAllowed({
  ...env, GITHUB_REF_NAME: branch,
  STAGING_DEPLOY_CONFIRM: "deploy-staging-only",
  STAGING_CLOUDFLARE_PROJECT: "dan-v1-staging-jongwoon",
  STAGING_VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
  STAGING_VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
  DAN_STAGING_SUPABASE_PROJECT_REF: "wmznpuhqmmqunwtewntt",
});
if (!decision.ok) { console.error(decision.message); process.exit(decision.code); }
Object.assign(env, { DAN_IOS_ENV: "staging", VITE_DAN_ENV: "staging", VITE_DATA_MODE: "supabase", VITE_BASE: "/" });
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { env, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("node_modules/typescript/bin/tsc", ["-b"]);
run("node_modules/vite/bin/vite.js", ["build"]);
const cli = "node_modules/@capacitor/cli/bin/capacitor";
run(cli, existsSync("ios") ? ["sync", "ios"] : ["add", "ios", "--packagemanager", "SPM"]);
// The CLI emits Windows separators in local Swift package paths. Xcode needs
// portable POSIX paths when this checkout is opened on a Mac.
const swiftPath = "ios/App/CapApp-SPM/Package.swift";
const swift = readFileSync(swiftPath, "utf8");
writeFileSync(swiftPath, swift.replace(/(path:\s*")([^"]+)(")/g, (_, start, path, end) => start + path.replace(/\\/g, "/") + end));
console.log("Staging iOS source prepared. Native compile/signing requires Mac/Xcode; no store upload performed.");
