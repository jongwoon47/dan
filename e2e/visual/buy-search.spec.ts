import { expect, test } from "@playwright/test";

test.describe("DAN V3 BUY request search", () => {
  test("typed product search stays above the sticky action and supports custom products", async ({
    page,
  }, testInfo) => {
    await page.goto("/create?type=BUY");

    await expect(
      page.getByRole("heading", { name: "어떤 물건을 찾고 있나요?" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "요청 유형 변경" })).toBeVisible();

    const input = page.getByLabel("찾는 제품");
    await input.click();
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await input.fill("Sony");
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await expect(list.getByText("Sony A7 IV")).toBeVisible();
    await expect(list.getByText("Sony RX100 VII")).toBeVisible();

    const listBox = await list.boundingBox();
    const next = page.getByRole("button", { name: "다음" });
    const nextBox = await next.boundingBox();
    expect(listBox).toBeTruthy();
    expect(nextBox).toBeTruthy();

    const listZ = await list.evaluate((el) => Number(getComputedStyle(el).zIndex) || 0);
    const footerZ = await page
      .locator(".create-page__footer")
      .evaluate((el) => Number(getComputedStyle(el).zIndex) || 0);
    expect(listZ).toBeGreaterThan(footerZ);

    await page.screenshot({
      path: `qa-screenshots/buy-search/${testInfo.project.name || "390"}-sony.png`,
      fullPage: false,
    });

    await input.fill("My Custom Gadget X");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await page.getByLabel("희망 가격 (최대)").fill("120000");
    await expect(next).toBeEnabled();
  });

  test("legacy BUY route redirects into the unified request flow", async ({ page }) => {
    await page.goto("/buy/new?q=Ricoh%20GR%20III");
    await expect(page).toHaveURL(/\/create\?type=BUY&q=Ricoh/);
    await expect(page.getByLabel("찾는 제품")).toHaveValue("Ricoh GR III");
  });
});
