import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { assertProductionDeployAllowed } from "../src/release/productionDeployGuard.ts";

const branch = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8" }).stdout.trim();
const env = { ...process.env };
if (!env.DAN_IOS_BUNDLE_ID?.trim()) {
  console.error("NEEDS USER: DAN_IOS_BUNDLE_ID must be the registered production bundle ID.");
  process.exit(2);
}
const decision = assertProductionDeployAllowed({
  ...env,
  GITHUB_REF_NAME: branch,
  DAN_ENV: "production",
  PRODUCTION_DEPLOY_CONFIRM: "deploy-production",
  PRODUCTION_CLOUDFLARE_PROJECT: "dan",
  PRODUCTION_VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
  PRODUCTION_VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
  DAN_PRODUCTION_SUPABASE_PROJECT_REF: "hcbooyexjgsjzjncpvtk",
});
if (!decision.ok) {
  console.error(decision.message);
  process.exit(decision.code);
}
Object.assign(env, {
  DAN_IOS_ENV: "production",
  VITE_DAN_ENV: "production",
  VITE_DATA_MODE: "supabase",
  VITE_BASE: "/",
});
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("node_modules/typescript/bin/tsc", ["-b"]);
run("node_modules/vite/bin/vite.js", ["build"]);
const cli = "node_modules/@capacitor/cli/bin/capacitor";
run(cli, existsSync("ios") ? ["sync", "ios"] : ["add", "ios", "--packagemanager", "SPM"]);
run("scripts/configure-ios-target.mjs", []);
console.log("Production iOS source prepared. Signing/upload still requires the registered Apple bundle ID and team.");
