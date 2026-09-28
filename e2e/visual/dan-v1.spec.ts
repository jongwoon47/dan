import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300);
}
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("DAN V1 blueprint screens render on mobile", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots","dan-v1",testInfo.project.name);
  mkdirSync(outDir,{ recursive:true });

  await page.goto("/");
  await settle(page);
  await expect(page.getByRole("heading",{ name:"지금 사고 있는 사람들" })).toBeVisible();
  await expect(page.getByRole("link",{ name:/내 구매수요/ })).toBeVisible();
  await expect(page.getByText("Fujifilm X100VI").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path:path.join(outDir,"01-home-live-demand.png"), fullPage:true });

  await page.goto("/buy/new");
  await settle(page);
  await expect(page.getByRole("heading",{ name:"원하는 조건만 간단하게 남겨주세요." })).toBeVisible();
  await expect(page.getByText("필수 조건")).toBeVisible();
  await expect(page.getByText("선호 조건")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path:path.join(outDir,"02-create-demand.png"), fullPage:true });

  await page.goto("/demand/prod-fuji-x100vi");
  await settle(page);
  await expect(page.getByText("Fujifilm X100VI").first()).toBeVisible();
  await expect(page.getByRole("link",{ name:"판매 제안하기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path:path.join(outDir,"03-live-demand-detail.png"), fullPage:true });

  await page.goto("/demand/prod-fuji-x100vi/offer");
  await settle(page);
  await expect(page.getByText("Quick Offer")).toBeVisible();
  await expect(page.getByRole("button",{ name:"제안 보내기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path:path.join(outDir,"04-quick-offer.png"), fullPage:true });

  await page.goto("/profile/user-you");
  await settle(page);
  await expect(page.getByText("Trust History")).toBeVisible();
  await expect(page.getByText("사실 기반 거래 기록")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path:path.join(outDir,"05-trust-history.png"), fullPage:true });
});
