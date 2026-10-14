/**
 * Browser smoke: App Review account against staging Pages (live DAN DB).
 *
 *   DAN_E2E_BASE_URL=https://dan-v1-staging-jongwoon.pages.dev \
 *   REVIEW_EMAIL=... REVIEW_PASSWORD=... \
 *   node scripts/e2e-staging-review-login.mjs
 *
 * Asserts authenticated /my content — leaving /login alone is not enough.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.env.DAN_E2E_BASE_URL?.replace(/\/$/, "");
const email = process.env.REVIEW_EMAIL?.trim();
const password = process.env.REVIEW_PASSWORD?.trim();
const outDir = process.env.DAN_E2E_SHOT_DIR || "/opt/cursor/artifacts/screenshots";

if (!base || !email || !password) {
  console.error("Need DAN_E2E_BASE_URL, REVIEW_EMAIL, REVIEW_PASSWORD");
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = { base, email, login: "FAIL", landed: "" };

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.screenshot({
    path: path.join(outDir, "staging-review-login.png"),
    fullPage: true,
  });

  await page.getByLabel(/이메일|email/i).fill(email);
  await page.getByLabel(/비밀번호|password/i).fill(password);
  await page.getByRole("button", { name: /이메일로 계속|continue|로그인|log ?in/i }).click();

  // Wait until AuthProvider has a session (Supabase localStorage key) and UI leaves login.
  await page.waitForFunction(
    () => {
      const hasToken = Object.keys(localStorage).some((k) =>
        /auth-token$/i.test(k),
      );
      return hasToken && !location.pathname.includes("/login");
    },
    null,
    { timeout: 45_000 },
  );

  // Consent gate if still required
  if (page.url().includes("/consent")) {
    const checkboxes = page.locator('input[type="checkbox"]');
    const n = await checkboxes.count();
    for (let i = 0; i < n; i++) {
      const box = checkboxes.nth(i);
      if (!(await box.isChecked())) await box.check({ force: true });
    }
    const continueBtn = page.getByRole("button", {
      name: /동의하고 계속|계속하기|확인|accept/i,
    });
    if (await continueBtn.count()) {
      await continueBtn.first().click();
    }
    await page.waitForFunction(
      () => !location.pathname.includes("/consent"),
      null,
      { timeout: 30_000 },
    );
  }

  await page.goto(`${base}/my`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("heading", { name: /내 거래|マイ取引/ }).waitFor({
    timeout: 30_000,
  });
  const body = await page.locator("body").innerText();
  if (/로그인이 필요|ログインが必要/.test(body)) {
    throw new Error("authenticated session missing on /my");
  }

  report.landed = page.url();
  report.login = "PASS";
  await page.screenshot({
    path: path.join(outDir, "staging-review-after-login.png"),
    fullPage: true,
  });
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  await page
    .screenshot({
      path: path.join(outDir, "staging-review-error.png"),
      fullPage: true,
    })
    .catch(() => {});
  console.error("STAGING REVIEW LOGIN FAILED:", e.message || e);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
