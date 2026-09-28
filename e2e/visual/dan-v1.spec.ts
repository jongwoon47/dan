import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test("DAN V1 core concept screens render on mobile", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v1", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/");
  await settle(page);
  await expect(
    page.getByRole("heading", { name: /찾아서 사는 게 아니라.*사고 싶다고 먼저 말해요/ }),
  ).toBeVisible();
  await expect(page.getByText("Fujifilm X100VI").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "01-home-live-demand.png"),
    fullPage: true,
  });

  await page.goto("/buy/new");
  await settle(page);
  await expect(page.getByRole("heading", { name: "사고 싶은 조건만 남겨주세요." })).toBeVisible();
  await expect(page.getByText("Fujifilm X100VI").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "02-create-demand.png"),
    fullPage: true,
  });

  await page.goto("/demand/prod-fuji-x100vi");
  await settle(page);
  await expect(page.getByText("Fujifilm X100VI").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "03-live-demand-detail.png"),
    fullPage: true,
  });

  await page.goto("/demand/prod-fuji-x100vi/offer");
  await settle(page);
  await expect(page.getByText("Quick Offer")).toBeVisible();
  await expect(page.getByRole("button", { name: "제안 보내기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "04-quick-offer.png"),
    fullPage: true,
  });

  await page.goto("/profile/user-you");
  await settle(page);
  await expect(page.getByText("Trust History")).toBeVisible();
  await expect(page.getByText("사실 기반 거래 기록")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "05-trust-history.png"),
    fullPage: true,
  });
});
