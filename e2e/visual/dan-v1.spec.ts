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

test("DAN V1 frozen UX flow renders on mobile", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v1", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/");
  await settle(page);
  await expect(page.getByRole("heading", { name: "사고 싶은 물건이 있나요?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "찾는 제품" })).toBeVisible();
  await expect(page.getByRole("button", { name: "구매수요 만들기" })).toBeVisible();
  await expect(page.getByText("iPhone 15 Pro")).toBeVisible();
  await expect(page.getByRole("button", { name: /가구/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "01-home.png"), fullPage: true });

  await page.goto("/buy/new");
  await settle(page);
  await expect(page.getByRole("heading", { name: "어떤 물건을 찾고 있나요?" })).toBeVisible();
  await expect(page.getByText("찾는 제품")).toBeVisible();
  await expect(page.getByText("필수 조건")).toBeVisible();
  await expect(page.getByText("선호 조건")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "02-demand-create.png"), fullPage: true });

  await installTradeFixture(page, "received");
  await page.goto("/my");
  await settle(page);
  await expect(page.getByRole("heading", { name: "내 구매수요" })).toBeVisible();
  await expect(page.getByText("최대 2,150,000원")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "03-my-demand.png"), fullPage: true });

  await page.goto("/my?tab=offers");
  await settle(page);
  await expect(page.getByRole("heading", { name: "받은 제안" })).toBeVisible();
  await expect(page.getByRole("link", { name: "제안 상세 보기" })).toBeVisible();
  await expect(page.locator(".received-offer-card .product-visual").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "04-received-offers.png"), fullPage: true });

  const potentialId = "potential::visual-demand-x100vi::visual-sell-x100vi";
  await page.goto("/offer/" + potentialId);
  await settle(page);
  await expect(page.getByText("판매 제안", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "관심 있어요" })).toBeVisible();
  await expect(page.getByText("거래 이력 보기")).toBeVisible();
  await expect(page.locator(".offer-detail-product--catalog .product-visual")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "05-offer-detail.png"), fullPage: true });

  await installTradeFixture(page, "connected");
  await page.goto("/deal/visual-match-x100vi/evidence");
  await settle(page);
  await expect(page.getByText("판매자가 제출한 정보예요")).toBeVisible();
  await expect(page.getByText("2,417컷")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "06-seller-evidence.png"), fullPage: true });

  await page.goto("/deal/visual-match-x100vi/snapshot");
  await settle(page);
  await expect(page.getByText("거래 조건", { exact: true })).toBeVisible();
  await expect(page.getByText("위 조건으로 거래를 진행합니다.")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "07-deal-snapshot.png"), fullPage: true });

  await installTradeFixture(page, "payment");
  await page.goto("/deal/visual-match-x100vi/payment");
  await settle(page);
  await expect(page.getByRole("heading", { name: "2,130,000원" })).toBeVisible();
  await expect(page.getByText("결제 수단")).toBeVisible();
  await expect(page.getByRole("button", { name: "2,130,000원 결제하기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "08-safe-payment.png"), fullPage: true });

  await installTradeFixture(page, "handoff");
  await page.goto("/deal/visual-match-x100vi/handoff");
  await settle(page);
  await expect(page.getByText("거래조건 확정")).toBeVisible();
  await expect(page.getByText("구매자 안전결제")).toBeVisible();
  await expect(page.getByText("직거래 · 인계 확인")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "09-direct-handoff.png"), fullPage: true });

  await installTradeFixture(page, "complete");
  await page.goto("/deal/visual-match-x100vi/complete");
  await settle(page);
  await expect(page.getByRole("heading", { name: "거래가 완료됐어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "내 거래 이력 보기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "10-trade-complete.png"), fullPage: true });

  await page.goto("/profile/user-you");
  await settle(page);
  await expect(page.getByText("Trust History")).toBeVisible();
  await expect(page.getByText("사실 기반 거래 기록")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "11-trust-history.png"), fullPage: true });

  await page.goto("/demand/prod-fuji-x100vi/offer");
  await settle(page);
  await expect(page.getByText("판매 제안", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "제안 보내기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(outDir, "12-seller-quick-offer.png"), fullPage: true });
});


test("open-catalog discovery searches beyond camera SKUs and carries intent forward", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v1", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/feed");
  await settle(page);

  await expect(page.getByRole("heading", { name: "사람들이 지금 찾는 제품" })).toBeVisible();
  await expect(page.getByText("Herman Miller Aeron Chair")).toBeVisible();
  await page.getByLabel("Live Demand 검색").fill("Aeron");
  await expect(page.getByText("Herman Miller Aeron Chair")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "15-open-catalog-discovery.png"),
    fullPage: true,
  });

  await page.getByText("Herman Miller Aeron Chair").click();
  await settle(page);
  await expect(page.getByRole("button", { name: "Live Demand 공유" })).toBeVisible();
  await expect(page.getByText(/명이 지금 찾고 있어요/)).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "16-demand-detail-share.png"),
    fullPage: true,
  });

  await page.goto("/feed");
  await settle(page);
  await page.getByLabel("Live Demand 검색").fill("Herman Miller Embody Chair");
  await expect(page.getByText(/Embody Chair.*Live Demand가 아직 없어요/)).toBeVisible();
  await page.getByRole("link", { name: "이 제품 구매수요 만들기" }).click();
  await settle(page);

  await expect(page).toHaveURL(/\/buy\/new\?q=/);
  await expect(page.getByLabel("찾는 제품")).toHaveValue("Herman Miller Embody Chair");
  await expectNoHorizontalOverflow(page);
});


test("open catalog accepts a product that is not pre-seeded", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v1", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/buy/new");
  await settle(page);

  await page.getByLabel("찾는 제품").fill("Herman Miller Embody Chair");
  await page.getByLabel("제품 카테고리").selectOption("furniture");
  await page.getByLabel("최대 구매 희망가").fill("1800000");
  await page.getByRole("button", { name: "다음 · 조건 확인" }).click();
  await expect(page.getByRole("heading", { name: "이 조건으로 구매수요를 올릴게요." })).toBeVisible();
  await page.getByRole("button", { name: "이 조건으로 구매수요 등록" }).click();
  await settle(page);

  await expect(page).toHaveURL(/\/my/);
  await expect(page.getByText("Herman Miller Embody Chair")).toBeVisible();
  await expect(page.getByText("최대 1,800,000원")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "13-open-catalog-custom-demand.png"),
    fullPage: true,
  });
});


test("BUY chat cancellation uses structured deal cancellation", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v1", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/");
  await settle(page);
  await installTradeFixture(page, "connected");
  await page.goto("/match/visual-match-x100vi");
  await settle(page);

  await expect(page.getByText("판매자 증거가 준비됐어요")).toBeVisible();
  await page.getByRole("button", { name: "거래 취소" }).click();
  await expect(page.getByText("이 거래를 종료할까요?")).toBeVisible();
  await page.getByRole("button", { name: "거래 종료" }).click();
  await settle(page);

  await expect(page.locator(".trade-status__state").getByText("거래가 종료됐어요")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "14-buy-chat-cancel.png"),
    fullPage: true,
  });
});
