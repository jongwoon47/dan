import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ROUTES = [
  { name: "home", path: "/" },
  { name: "feed", path: "/feed" },
  { name: "create", path: "/create" },
  { name: "my", path: "/my" },
  { name: "activity", path: "/activity" },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
    const clientW = doc.clientWidth;
    return { scrollW, clientW, overflowPx: scrollW - clientW };
  });
  expect(
    overflow.overflowPx,
    `horizontal overflow ${overflow.overflowPx}px (scroll=${overflow.scrollW}, client=${overflow.clientW})`,
  ).toBeLessThanOrEqual(1);
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
}

test.describe("mobile visual QA", () => {
  test("core screens fit and capture", async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const outDir = path.join("qa-screenshots", project);
    mkdirSync(outDir, { recursive: true });

    const findings: string[] = [];

    for (const route of ROUTES) {
      await page.goto(route.path);
      await settle(page);

      try {
        await assertNoHorizontalOverflow(page);
      } catch (e) {
        findings.push(`${route.name}: ${(e as Error).message}`);
      }

      await page.screenshot({
        path: path.join(outDir, `${route.name}.png`),
        fullPage: true,
      });
    }

    // Deep: first feed card if present
    await page.goto("/feed");
    await settle(page);
    const firstCard = page.locator("a.feed-row").first();
    if (await firstCard.count()) {
      await firstCard.click();
      await settle(page);
      try {
        await assertNoHorizontalOverflow(page);
      } catch (e) {
        findings.push(`detail: ${(e as Error).message}`);
      }
      await page.screenshot({
        path: path.join(outDir, "detail.png"),
        fullPage: true,
      });
    }

    // Create phase 2 sticky footer at 390-class widths
    await page.goto("/create?type=TASK");
    await settle(page);
    await page.getByRole("radio", { name: "심부름" }).click();
    await page.getByLabel("요청 제목").fill("모바일 QA 심부름");
    await page.getByLabel("보상").fill("10000");
    await page.getByRole("button", { name: "다음" }).click();
    await settle(page);
    try {
      await assertNoHorizontalOverflow(page);
    } catch (e) {
      findings.push(`create-phase2: ${(e as Error).message}`);
    }
    await page.screenshot({
      path: path.join(outDir, "create-phase2.png"),
      fullPage: true,
    });

    expect(findings, findings.join("\n")).toEqual([]);
  });
});
