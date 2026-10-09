import { expect, test } from "@playwright/test";

/** Demo-only UX acceptance. This does not certify native iOS or JP production readiness. */
test("Japanese location discovery, saved area, and route controls", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("combobox", { name: "표시 언어" }).selectOption("ja");
  await expect(page.getByRole("heading", { name: "表示言語" })).toBeVisible();

  await page.getByRole("combobox", { name: "取引する国・地域" }).selectOption("JP");
  await page.getByPlaceholder("例：博多区、城東区").fill("博多区");
  await page.getByRole("button", { name: "地域を保存" }).click();
  await expect(page.getByRole("link", { name: /JP · 博多区/ })).toBeVisible();

  await page.getByRole("link", { name: /JP · 博多区/ }).click();
  await expect(page.getByRole("heading", { name: "募集中の依頼" })).toBeVisible();
  await expect(page.getByPlaceholder("例：博多区、城東区")).toHaveValue("博多区");
  await expect(page.getByRole("button", { name: "オンライン・配送" })).toBeVisible();

  await page.getByRole("button", { name: "移動途中のおつかい" }).click();
  await page.getByRole("textbox", { name: "出発地" }).fill("博多駅");
  await page.getByRole("textbox", { name: "目的地" }).fill("天神駅");
  await expect(page.getByText(/実際の経路や所要時間の計算はまだ行いません/)).toBeVisible();

  await page.goto("/create?type=TASK");
  await expect(page.getByText(/韓国ウォン（KRW）/).first()).toBeVisible();
  await expect(page.getByText(/日本円での取引はまだ利用できません/).first()).toBeVisible();

  const overflow = await page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
    document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
