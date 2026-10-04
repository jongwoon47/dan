import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const STORE_KEY = "dan-v2-fulfillment-store";

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

type Stage = "received" | "connected" | "payment" | "handoff" | "complete";

function tradeFixture(stage: Stage) {
  const now = Date.now();
  const createdAt = new Date(now - 18 * 60 * 1000).toISOString();
  const future = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
  const paymentDueAt = new Date(now + 4 * 60 * 60 * 1000).toISOString();
  const lockedAt = new Date(now - 4 * 60 * 1000).toISOString();
  const completedAt = new Date(now - 60 * 1000).toISOString();

  const demand = {
    id: "visual-demand-x100vi",
    userId: "user-you",
    type: "BUY",
    title: "Fujifilm X100VI Black",
    description: "Fujifilm X100VI Black 구매수요 · 서울 직거래",
    category: "camera",
    budget: 2_150_000,
    fulfillmentOptions: [
      { mode: "MEETUP", place: { publicLabel: "서울" } },
    ],
    status: stage === "received" ? "ACTIVE" : "MATCHED",
    createdAt,
    expiresAt: future,
    details: {
      productId: "prod-fuji-x100vi",
      maxPrice: 2_150_000,
      conditionPreference: "lightly_used",
      tradeMethod: "meetup",
    },
  };

  const ownership = {
    id: "visual-own-x100vi",
    userId: "user-jun",
    productId: "prod-fuji-x100vi",
    condition: "like_new",
    status: "OWNED",
    createdAt,
  };

  const sell = {
    id: "visual-sell-x100vi",
    ownershipId: ownership.id,
    userId: "user-jun",
    productId: "prod-fuji-x100vi",
    minimumPrice: 2_130_000,
    targetDemandId: demand.id,
    tradeMethod: "meetup",
    // 판매 제안 photos are optional. Keep the visual fixture photo-less so QA
    // exercises the real compact no-photo product treatment instead of a fake placeholder.
    quickPhotoUrl: undefined,
    approxUsageCount: 2_400,
    conditionNote: "상태 좋음 · 상단 미세스크래치",
    status: stage === "received" ? "OPEN" : "MATCHED",
    createdAt,
  };

  const persistedMatch = stage === "received"
    ? null
    : {
        id: "visual-match-x100vi",
        demandId: demand.id,
        sellIntentId: sell.id,
        productId: "prod-fuji-x100vi",
        buyerId: "user-you",
        sellerId: "user-jun",
        status: stage === "complete" ? "COMPLETED" : "CONNECTED",
        dealStage:
          stage === "connected"
            ? "EVIDENCE_READY"
            : stage === "payment"
              ? "PAYMENT_PENDING"
              : stage === "handoff"
                ? "HANDOFF_READY"
                : "COMPLETED",
        paymentStatus:
          stage === "connected"
            ? "NOT_STARTED"
            : stage === "payment"
              ? "PENDING"
              : "PAID",
        paymentDueAt:
          stage === "payment" || stage === "handoff"
            ? paymentDueAt
            : undefined,
        createdAt,
        buyerCompletedAt: stage === "complete" ? completedAt : undefined,
        sellerCompletedAt: stage === "complete" ? completedAt : undefined,
        completedAt: stage === "complete" ? completedAt : undefined,
      };

  const evidence = {
    id: "visual-evidence-x100vi",
    matchId: "visual-match-x100vi",
    sellerId: "user-jun",
    possessionPhotoUrl: "",
    serialLast4: "3812",
    usageCount: 2_417,
    purchaseDate: "2024-03-15",
    warrantyUntil: "2027-03-15",
    components: ["풀박스", "정품 배터리", "스트랩"],
    cosmeticNotes: "상단 미세스크래치 1곳",
    knownIssues: "없음",
    repairHistory: "없음",
    waterDamageStatement: "없음",
    evidenceMeta: { source: "visual_qa_fixture" },
    submittedAt: createdAt,
    updatedAt: createdAt,
  };

  const snapshotPayload = {
    schemaVersion: "dan.deal_snapshot.v1",
    product: {
      id: "prod-fuji-x100vi",
      name: "Fujifilm X100VI",
      brand: "Fujifilm",
      model: "X100VI",
    },
    offer: {
      price: 2_130_000,
      approxUsageCount: 2_400,
      conditionNote: "상태 좋음 · 상단 미세스크래치",
    },
    evidence: {
      evidenceId: evidence.id,
      serialLast4: evidence.serialLast4,
      usageCount: evidence.usageCount,
      purchaseDate: evidence.purchaseDate,
      warrantyUntil: evidence.warrantyUntil,
      components: evidence.components,
      cosmeticNotes: evidence.cosmeticNotes,
      knownIssues: evidence.knownIssues,
      repairHistory: evidence.repairHistory,
      waterDamageStatement: evidence.waterDamageStatement,
    },
    handoff: {
      method: "서울 · 직거래",
      fulfillmentOptions: demand.fulfillmentOptions,
    },
  };

  const hasLockedSnapshot =
    stage === "payment" || stage === "handoff" || stage === "complete";

  const snapshot = hasLockedSnapshot
    ? {
        id: "visual-snapshot-x100vi",
        matchId: "visual-match-x100vi",
        demandId: demand.id,
        productId: "prod-fuji-x100vi",
        buyerId: "user-you",
        sellerId: "user-jun",
        agreedPrice: 2_130_000,
        snapshot: snapshotPayload,
        buyerConfirmedAt: lockedAt,
        sellerConfirmedAt: lockedAt,
        lockedAt,
        createdAt,
        updatedAt: lockedAt,
      }
    : null;

  return {
    currentUserId: "user-you",
    demands: [demand],
    ownerships: [ownership],
    sellIntents: [sell],
    responses: [],
    matches: persistedMatch ? [persistedMatch] : [],
    dealEvidenceChallenges: [],
    dealEvidence: stage === "received" ? [] : [evidence],
    dealSnapshots: snapshot ? [snapshot] : [],
    dealDisputes: [],
  };
}

async function installTradeFixture(page: Page, stage: Stage) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORE_KEY, value: tradeFixture(stage) },
  );
}

test("DAN App V3 core request and transaction journey renders", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v3", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/");
  await settle(page);
  await expect(page.getByRole("heading", { name: "무엇이 필요하세요?" })).toBeVisible();
  const homeTypes = page.locator(".home-request-types");
  for (const label of ["구매", "빌리기", "심부름", "서비스"]) {
    await expect(homeTypes.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  if (testInfo.project.name === "desktop") {
    await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeHidden();
  } else {
    await expect(page.getByRole("navigation", { name: "하단 메뉴" })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "01-home.png"), fullPage: true });

  await page.goto("/create");
  await settle(page);
  for (const label of ["구매", "빌리기", "심부름", "서비스"]) {
    await expect(page.getByRole("radio", { name: new RegExp(label) })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "02-create-entry.png"), fullPage: true });

  await page.goto("/create?type=BUY");
  await settle(page);
  await expect(page.getByRole("heading", { name: "어떤 물건을 찾고 있나요?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "요청 유형 변경" })).toBeVisible();
  await expect(page.getByLabel("찾는 제품")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "03-create-buy.png"), fullPage: true });

  await installTradeFixture(page, "received");
  await page.goto("/my?tab=requests");
  await settle(page);
  await expect(page.getByRole("heading", { name: "내 거래" })).toBeVisible();
  await expect(page.getByRole("button", { name: /내 요청/ })).toBeVisible();
  await expect(page.getByText("Fujifilm X100VI Black")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "04-my-requests.png"), fullPage: true });

  const potentialId = "potential::visual-demand-x100vi::visual-sell-x100vi";
  await page.goto("/offer/" + potentialId);
  await settle(page);
  await expect(page.getByText("판매 제안", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "이 제안 선택하기" })).toBeVisible();
  await expect(page.getByText("거래 이력 보기")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "05-offer-detail.png"), fullPage: true });

  await installTradeFixture(page, "connected");
  await page.goto("/deal/visual-match-x100vi/evidence");
  await settle(page);
  await expect(page.getByText("판매자가 등록한 상품 정보예요")).toBeVisible();
  await expect(page.getByText("2,417컷")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "06-product-info.png"), fullPage: true });

  await page.goto("/deal/visual-match-x100vi/snapshot");
  await settle(page);
  await expect(page.getByRole("heading", { name: "거래 조건을 확인해 주세요" })).toBeVisible();
  await expect(page.getByText("확인하면 이 조건으로 거래가 확정돼요.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "07-terms.png"), fullPage: true });

  await installTradeFixture(page, "payment");
  await page.goto("/deal/visual-match-x100vi/payment");
  await settle(page);
  await expect(page.getByRole("heading", { name: "2,130,000원" })).toBeVisible();
  await expect(page.locator(".payment-section-head h2", { hasText: "결제 수단" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2,130,000원 결제하기" })).toBeVisible();
  await expect(page.getByText("테스트 환경에서 결제 흐름을 확인하고 있어요.")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "08-payment.png"), fullPage: true });

  await installTradeFixture(page, "handoff");
  await page.goto("/deal/visual-match-x100vi/handoff");
  await settle(page);
  await expect(page.getByText("인계", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("확정한 거래 조건과 실제 물건이 같은지 마지막으로 확인해요.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "09-handoff.png"), fullPage: true });

  await installTradeFixture(page, "complete");
  await page.goto("/deal/visual-match-x100vi/complete");
  await settle(page);
  await expect(page.getByRole("heading", { name: "거래가 완료됐어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "거래 내역 보기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "10-complete.png"), fullPage: true });

  await page.goto("/profile/user-you");
  await settle(page);
  await expect(page.getByText("거래 신뢰")).toBeVisible();
  await expect(page.getByText("확정된 거래 기록")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "11-profile.png"), fullPage: true });

  await page.goto("/demand/prod-fuji-x100vi/offer?target=visual-demand-x100vi");
  await settle(page);
  await expect(page.getByRole("button", { name: "제안 보내기" })).toBeVisible();
  await expect(page.getByText("선택한 구매수요 · 최대 희망가")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "12-offer-create.png"), fullPage: true });
});

test("V3 explore searches all request types and carries a missing query into create", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v3", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/feed");
  await settle(page);

  await expect(page.getByRole("heading", { name: "지금 필요한 사람들" })).toBeVisible();
  await expect(page.getByRole("button", { name: "심부름" })).toBeVisible();
  await page.getByLabel("요청 검색").fill("Aeron");
  await expect(page.getByText("Herman Miller Aeron Chair")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "13-explore-search.png"),
    fullPage: true,
  });

  await page.getByLabel("요청 검색").fill("Herman Miller Embody Chair");
  await expect(page.getByText(/요청이 아직 없어요/)).toBeVisible();
  await page.getByRole("link", { name: "요청 올리기" }).first().click();
  await settle(page);

  await expect(page).toHaveURL(/\/create\?type=BUY&q=/);
  await expect(page.getByLabel("찾는 제품")).toHaveValue("Herman Miller Embody Chair");
  await expectNoHorizontalOverflow(page);
});

test("V3 BUY chat cancellation keeps the request lifecycle structured", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v3", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/");
  await settle(page);
  await installTradeFixture(page, "connected");
  await page.goto("/match/visual-match-x100vi");
  await settle(page);

  await expect(page.getByText("상품 정보가 준비됐어요")).toBeVisible();
  await page.getByRole("button", { name: "거래 취소" }).click();
  await expect(page.getByText("이 거래를 종료할까요?")).toBeVisible();
  await page.getByRole("button", { name: "거래 종료" }).click();
  await settle(page);

  await expect(page.locator(".trade-status__state").getByText("거래가 종료됐어요")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "14-chat-cancel.png"),
    fullPage: true,
  });
});
