import { expect, test, type Page } from "@playwright/test";

const STORE_KEY = "dan-v2-fulfillment-store";
const LONG_NAME =
  "Herman Miller Aeron Chair Remastered Graphite Frame PostureFit SL";
const LONG_NOTE = "상단프레임미세스크래치확인필요".repeat(12);

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
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
}

function dealFixture() {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
  return {
    currentUserId: "user-you",
    demands: [
      {
        id: "edge-demand",
        userId: "user-you",
        type: "BUY",
        title: LONG_NAME,
        description: LONG_NAME,
        category: "furniture",
        budget: 128500000,
        fulfillmentOptions: [{ mode: "MEETUP", place: { publicLabel: "서울" } }],
        status: "MATCHED",
        createdAt: now,
        expiresAt: future,
        details: {
          productId: "prod-fuji-x100vi",
          maxPrice: 128500000,
          conditionPreference: "any",
          tradeMethod: "meetup",
        },
      },
    ],
    ownerships: [
      {
        id: "edge-own",
        userId: "user-jun",
        productId: "prod-fuji-x100vi",
        condition: "like_new",
        status: "OWNED",
        createdAt: now,
      },
    ],
    sellIntents: [
      {
        id: "edge-sell",
        ownershipId: "edge-own",
        userId: "user-jun",
        productId: "prod-fuji-x100vi",
        minimumPrice: 128500000,
        targetDemandId: "edge-demand",
        tradeMethod: "meetup",
        quickPhotoUrl: "",
        conditionNote: LONG_NOTE,
        status: "MATCHED",
        createdAt: now,
      },
    ],
    responses: [],
    matches: [
      {
        id: "edge-match",
        demandId: "edge-demand",
        sellIntentId: "edge-sell",
        productId: "prod-fuji-x100vi",
        buyerId: "user-you",
        sellerId: "user-jun",
        status: "CONNECTED",
        dealStage: "EVIDENCE_READY",
        paymentStatus: "NOT_STARTED",
        createdAt: now,
      },
    ],
    dealEvidenceChallenges: [],
    dealEvidence: [
      {
        id: "edge-evidence",
        matchId: "edge-match",
        sellerId: "user-jun",
        possessionPhotoUrl: "",
        serialLast4: "3812",
        usageCount: 12,
        purchaseDate: "2024-03-15",
        components: ["풀박스"],
        cosmeticNotes: LONG_NOTE,
        knownIssues: "없음",
        repairHistory: "없음",
        waterDamageStatement: "없음",
        evidenceMeta: { source: "beta_edge" },
        submittedAt: now,
        updatedAt: now,
      },
    ],
    dealSnapshots: [],
    dealDisputes: [],
  };
}

async function installDeal(page: Page) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORE_KEY, value: dealFixture() },
  );
}

test.beforeEach(({ }, testInfo) => {
  test.skip(testInfo.project.name !== "390px", "edge widths are asserted inside the 390px project");
});

for (const width of [320, 390, 430]) {
  test(`core screens stay inside ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/");
    await settle(page);
    await expect(page.getByRole("button", { name: "요청 만들기" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/create?type=BUY");
    await settle(page);
    await page.getByLabel("찾는 제품").fill(LONG_NAME);
    await page.getByLabel("희망 가격 (최대)").fill("128500000");
    await expectControlInView(page, "다음");
    await expectNoHorizontalOverflow(page);
  });
}

test("a short viewport still reaches the create CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.goto("/create?type=BUY");
  await settle(page);
  await page.getByLabel("찾는 제품").focus();
  await expectControlInView(page, "다음");
  await expectNoHorizontalOverflow(page);
});

test("empty activity, empty chat, long evidence, and a missing photo stay in frame", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/activity");
  await settle(page);
  await expect(page.getByText("새로운 알림이 없어요.")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await installDeal(page);
  await page.goto("/match/edge-match");
  await settle(page);
  await expect(page.getByText("아직 메시지가 없어요. 장소나 시간을 먼저 맞춰보세요.")).toBeVisible();
  await page.getByLabel("메시지 입력").fill("장소".repeat(80));
  await expectControlInView(page, "보내기");
  await expect(page.locator(".chat-page__demand")).toHaveText(LONG_NAME);
  await expectNoHorizontalOverflow(page);

  await page.goto("/deal/edge-match/evidence");
  await settle(page);
  await expect(page.getByText(LONG_NOTE)).toBeVisible();
  await expect(page.getByRole("img", { name: "판매자가 제출한 현재 보유 물품" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.goto("/offer/edge-match");
  await settle(page);
  await expect(page.getByText("판매 제안", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /판매자가 올린 현재 물품/ })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});


test("BUY product suggestions stay in frame and selection carries forward", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto("/create?type=BUY");
  await settle(page);

  const input = page.getByLabel("찾는 제품");
  await input.fill("MacBook");

  const suggestion = page.locator(".product-suggest__item").first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(input).not.toHaveValue("");
  await expectNoHorizontalOverflow(page);
});


test("BUY phase 2 back returns to request details", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/create?type=BUY");
  await settle(page);

  await page.getByLabel("찾는 제품").fill("MacBook Pro 14 M4");
  await page.getByLabel("희망 가격 (최대)").fill("2500000");
  await page.getByRole("button", { name: "다음" }).click();

  await expect(
    page.getByRole("heading", { name: "어떻게 받을까요?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "이전" }).click();

  await expect(
    page.getByRole("heading", { name: "어떤 물건을 찾고 있나요?" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/create\?type=BUY/);
  await expectNoHorizontalOverflow(page);
});

  await page.getByLabel("찾는 제품").fill("MacBook Pro 14 M4");
  await page.getByLabel("희망 가격 (최대)").fill("2500000");
  await page.getByRole("button", { name: "다음" }).click();

  await expect(
    page.getByRole("heading", { name: "이 조건으로 구매수요를 올릴게요." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "뒤로가기" }).click();

  await expect(
    page.getByRole("heading", { name: "어떤 물건을 찾고 있나요?" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/buy\/new/);
  await expectNoHorizontalOverflow(page);
});
