/**
 * Build + inspect the production web bundle that would replace dan.pages.dev.
 * Does not deploy.
 *
 *   VITE_SUPABASE_URL=https://wmznpuhqmmqunwtewntt.supabase.co \
 *   VITE_SUPABASE_ANON_KEY=sb_publishable_… \
 *   node scripts/assert-production-bundle.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { assertProductionDeployAllowed } from "../src/release/productionDeployGuard.ts";

const url = process.env.VITE_SUPABASE_URL?.trim() ?? "";
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";

const decision = assertProductionDeployAllowed({
  DAN_ENV: "production",
  VITE_DAN_ENV: "production",
  GITHUB_REF_NAME: "main", // readiness check only; real deploy still gated on main
  PRODUCTION_DEPLOY_CONFIRM: "deploy-production",
  PRODUCTION_CLOUDFLARE_PROJECT: "dan",
  PRODUCTION_VITE_SUPABASE_URL: url,
  PRODUCTION_VITE_SUPABASE_ANON_KEY: key,
  DAN_PRODUCTION_SUPABASE_PROJECT_REF: "wmznpuhqmmqunwtewntt",
});
if (!decision.ok) {
  console.error(decision.message);
  process.exit(decision.code);
}

const env = {
  ...process.env,
  DAN_ENV: "production",
  VITE_DAN_ENV: "production",
  VITE_DATA_MODE: "supabase",
  VITE_BASE: "/",
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_ANON_KEY: key,
};

console.log("Building production bundle…");
const build = spawnSync("npm", ["run", "build"], {
  env,
  encoding: "utf8",
  shell: true,
});
process.stdout.write(build.stdout || "");
process.stderr.write(build.stderr || "");
if (build.status !== 0) process.exit(build.status ?? 1);

const dist = "dist";
const index = readFileSync(path.join(dist, "index.html"), "utf8");
if (/HELLO WORLD/i.test(index)) {
  console.error("FAIL: dist/index.html looks like HELLO WORLD stub");
  process.exit(1);
}
if (!/dan-logo|root/i.test(index)) {
  console.error("FAIL: dist/index.html missing DAN app markers");
  process.exit(1);
}

const assetsDir = path.join(dist, "assets");
const jsFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((f) => f.endsWith(".js"))
  : [];
let blob = index;
for (const f of jsFiles) blob += readFileSync(path.join(assetsDir, f), "utf8");

// Guards intentionally mention the retired ref and "service_role" regex text.
// Fail only on a wired retired URL or an embedded secret key material.
const checks = {
  liveSupabaseUrl: /https:\/\/wmznpuhqmmqunwtewntt\.supabase\.co/.test(blob),
  retiredSupabaseUrl: /https:\/\/hcbooyexjgsjzjncpvtk\.supabase\.co/i.test(blob),
  retiredRefListedForGuard: /hcbooyexjgsjzjncpvtk/i.test(blob),
  publishableKey: blob.includes(key) || /sb_publishable_/.test(blob),
  signInWithIdToken: blob.includes("signInWithIdToken"),
  helloWorld: /HELLO WORLD/i.test(blob),
  serviceRoleJwtLeak: /eyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){2}/.test(blob) &&
    /"role"\s*:\s*"service_role"/.test(
      Buffer.from(
        (blob.match(/eyJ[A-Za-z0-9_-]+/) || [""])[0].split(".")[1] || "",
        "base64url",
      ).toString("utf8") + "}",
    ),
  sbSecretLeak: /sb_secret_[A-Za-z0-9_-]+/.test(blob),
};

console.log(JSON.stringify({ project: "dan", url: "https://dan.pages.dev", checks }, null, 2));

if (
  !checks.liveSupabaseUrl ||
  checks.retiredSupabaseUrl ||
  checks.helloWorld ||
  checks.sbSecretLeak
) {
  console.error("FAIL: production bundle checks");
  process.exit(1);
}
if (!checks.publishableKey) {
  console.error("FAIL: publishable key not embedded");
  process.exit(1);
}

console.log("Production bundle READY for Cloudflare Pages project `dan` (deploy still needs approval).");
