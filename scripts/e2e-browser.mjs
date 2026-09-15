/**
 * Browser E2E against live Supabase via Playwright.
 * Run: npm run test:e2e:browser
 */
import { spawnSync } from "node:child_process";

const mode = process.env.VITE_DATA_MODE;
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (mode === "demo" || !url || !key) {
  console.error("BLOCKED: need VITE_DATA_MODE≠demo and Supabase env");
  process.exit(2);
}

const result = spawnSync(
  "npx",
  ["playwright", "test", "--config=playwright.config.ts"],
  { stdio: "inherit", shell: true, env: process.env },
);
process.exit(result.status ?? 1);
