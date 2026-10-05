import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.DAN_E2E_BASE_URL ?? "http://127.0.0.1:5175";

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  throw new Error("Supabase browser smoke requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

export default defineConfig({
  testDir: "e2e/supabase",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  outputDir: "qa-screenshots/supabase-test-output",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5175",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_DATA_MODE: "supabase",
      VITE_DAN_DATA_MODE: "supabase",
      VITE_DAN_ENV: "test",
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    },
  },
});
