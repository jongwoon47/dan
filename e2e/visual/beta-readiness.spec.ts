import { expect, test, type Page } from "@playwright/test";

const LONG_NAME =
  "Herman Miller Aeron Chair Remastered Graphite Frame PostureFit SL";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(200);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectControlInView(page: Page, name: string) {
  const control = page.getByRole("button", { name });
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
}

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "390px",
    "edge widths are asserted inside the canonical 390px project",
  );
});

for (const width of [320, 390, 430]) {
  test(`V3 root and unified create stay inside ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });

    await page.goto("/");
    await settle(page);
    await expect(page.getByRole("heading", { name: "무엇이 필요하세요?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "심부름", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/create");
    await settle(page);
    for (const label of ["구매", "빌리기", "심부름", "서비스"]) {
      await expect(page.getByRole("radio", { name: new RegExp(label) })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);

    await page.goto("/create?type=BUY");
    await settle(page);
    await page.getByLabel("찾는 제품").fill(LONG_NAME);
    await page.getByLabel("희망 가격 (최대)").fill("128500000");
    await expectControlInView(page, "다음");
    await expectNoHorizontalOverflow(page);
  });
}

test("short viewport still reaches the unified create CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/create?type=BUY");
  await settle(page);

  await page.getByLabel("찾는 제품").fill("iPhone 14 Pro");
  await page.getByLabel("희망 가격 (최대)").fill("900000");
  await expectControlInView(page, "다음");
  await expectNoHorizontalOverflow(page);
});

test("all four request types have dedicated question-first screens", async ({ page }) => {
  const cases = [
    ["BUY", "어떤 물건을 찾고 있나요?"],
    ["BORROW", "어떤 물건을 빌리고 싶나요?"],
    ["TASK", "어떤 일을 부탁하고 싶나요?"],
    ["SERVICE", "어떤 도움이 필요하세요?"],
  ] as const;

  for (const [type, heading] of cases) {
    await page.goto(`/create?type=${type}`);
    await settle(page);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("button", { name: "요청 유형 변경" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
