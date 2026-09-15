import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("BORROW datetime empty state shows Korean placeholder", async ({ page }) => {
  mkdirSync("qa-screenshots/datetime", { recursive: true });
  await page.goto("/create?type=BORROW");
  await page.getByRole("radio", { name: "빌리기" }).click();
  await page.getByLabel("요청 제목").fill("캠핑 텐트");
  await page.getByLabel(/예산/).fill("30000");
  await page.getByRole("button", { name: "다음" }).click();

  await expect(page.getByText("날짜와 시간을 선택해 주세요").first()).toBeVisible();
  await expect(page.locator("text=mm/dd/yyyy")).toHaveCount(0);

  await page.screenshot({
    path: "qa-screenshots/datetime/borrow-phase2.png",
    fullPage: true,
  });
});
