/**
 * Browser E2E placeholder — requires Playwright browsers + running Vite.
 * Reported BLOCKED when PLAYWRIGHT_BROWSERS_PATH / chromium not installed.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const mode = process.env.VITE_DATA_MODE;
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (mode === "demo" || !url || !key) {
  console.error("BLOCKED: need VITE_DATA_MODE=supabase and Supabase env");
  process.exit(2);
}

const hasPlaywright = existsSync("node_modules/playwright") || existsSync("node_modules/@playwright/test");
if (!hasPlaywright) {
  console.log("Browser E2E: BLOCKED (Playwright not installed in this environment)");
  console.log("Install: npm i -D @playwright/test && npx playwright install chromium");
  console.log("Then re-run npm run test:e2e:browser with Vite on :5173");
  process.exit(2);
}

const result = spawnSync(
  "npx",
  ["playwright", "test", "e2e/browser", "--reporter=line"],
  { stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
