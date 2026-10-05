import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ROUTES = [
  { name: "home", path: "/" },
  { name: "explore", path: "/feed" },
  { name: "create", path: "/create" },
  { name: "chats", path: "/chats" },
  { name: "my", path: "/my" },
  { name: "activity", path: "/activity" },
  { name: "login", path: "/login" },
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
  await page.waitForTimeout(300);
}

test.describe("DAN V3 responsive visual QA", () => {
  test("core app screens fit and capture", async ({ page }, testInfo) => {
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

    for (const type of ["BUY", "BORROW", "TASK", "SERVICE"] as const) {
      await page.goto(`/create?type=${type}`);
      await settle(page);
      try {
        await assertNoHorizontalOverflow(page);
      } catch (e) {
        findings.push(`create-${type.toLowerCase()}: ${(e as Error).message}`);
      }
      await page.screenshot({
        path: path.join(outDir, `create-${type.toLowerCase()}-phase1.png`),
        fullPage: true,
      });
    }

    await page.goto("/feed");
    await settle(page);
    const firstCard = page.locator("a.feed-row, a.individual-demand-card").first();
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

    await page.goto("/create?type=BUY");
    await settle(page);
    await page.getByLabel("찾는 제품").fill("iPhone 14 Pro");
    await page.getByLabel("희망 가격 (최대)").fill("900000");
    await page.getByRole("button", { name: "다음" }).click();
    await settle(page);

    try {
      await assertNoHorizontalOverflow(page);
    } catch (e) {
      findings.push(`create-phase2: ${(e as Error).message}`);
    }

    await page.screenshot({
      path: path.join(outDir, "create-buy-phase2.png"),
      fullPage: true,
    });

    expect(findings, findings.join("\n")).toEqual([]);
  });
});
