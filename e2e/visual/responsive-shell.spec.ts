import { expect, test } from "@playwright/test";

test.describe("responsive DAN shell", () => {
  test("mobile uses app composition", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "390px",
      "mobile shell contract is asserted on the canonical 390px project",
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle").catch(() => undefined);

    await expect(page.locator(".bottom-nav--v1")).toBeVisible();
    await expect(page.locator(".top-nav__links")).toBeHidden();

    const main = await page.locator(".app-main").boundingBox();
    expect(main).not.toBeNull();
    expect(main!.width).toBeLessThanOrEqual(390);
    expect(main!.width).toBeGreaterThanOrEqual(350);

    await page.goto("/create?type=BORROW");
    await expect(page.getByText("어떤 물건을 빌리고 싶나요?")).toBeVisible();
    await expect(page.locator(".create-page__footer")).toBeVisible();
  });

  test("desktop uses web composition", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "desktop shell contract is asserted on the desktop project",
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle").catch(() => undefined);

    await expect(page.locator(".top-nav__links")).toBeVisible();
    await expect(page.locator(".bottom-nav--v1")).toBeHidden();

    const main = await page.locator(".app-main").boundingBox();
    expect(main).not.toBeNull();
    expect(main!.width).toBeGreaterThanOrEqual(1000);
    expect(main!.width).toBeLessThanOrEqual(1182);

    await page.goto("/create?type=BORROW");
    await expect(page.getByText("어떤 물건을 빌리고 싶나요?")).toBeVisible();

    const form = await page.locator(".create-page").boundingBox();
    expect(form).not.toBeNull();
    expect(form!.width).toBeLessThanOrEqual(722);
    expect(form!.width).toBeGreaterThanOrEqual(600);
  });
});
