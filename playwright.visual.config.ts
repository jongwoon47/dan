import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.DAN_E2E_BASE_URL ?? "http://127.0.0.1:5174";

/**
 * Mobile visual QA — demo mode, three phone shapes.
 * Run: npm run test:qa:mobile
 */
export default defineConfig({
  testDir: "e2e/visual",
  fullyParallel: true,
  workers: 3,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "qa-screenshots/test-output",
  use: {
    baseURL,
    trace: "off",
  },
  projects: [
    {
      name: "390px",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "iphone",
      use: {
        ...devices["iPhone 13"],
        // Real WebKit/Safari isn't installed on this Windows host; layout-check with iPhone metrics on Chromium.
        browserName: "chromium",
      },
    },
    {
      name: "android",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Layout QA should not depend on live auth; demo has seeded consumer UI.
      VITE_DATA_MODE: "demo",
      VITE_DAN_DATA_MODE: "demo",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});
