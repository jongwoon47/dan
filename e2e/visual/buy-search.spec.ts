import { expect, test } from "@playwright/test";

test.describe("BUY product search-first", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  test("empty query hides catalog; typing shows matches above CTA", async ({
    page,
  }, testInfo) => {
    await page.goto("/create?type=BUY");
    await page.getByRole("radio", { name: "물건 구매" }).click();

    const input = page.getByLabel("찾는 제품");
    await input.click();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByText("AirPods Pro 2")).toHaveCount(0);
    await expect(page.getByText("iPhone 15 Pro")).toHaveCount(0);

    await input.fill("Sony");
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await expect(list.getByRole("option")).toHaveCount(2);
    await expect(list.getByText("AirPods Pro 2")).toHaveCount(0);

    // Dropdown must stack above sticky next CTA (not covered by it).
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

    // Custom typed name with no catalog match still enables next when price set.
    await input.fill("My Custom Gadget X");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await page.getByLabel("희망 가격 (최대)").fill("120000");
    await expect(next).toBeEnabled();
  });
});
