import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.DAN_E2E_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "e2e/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
