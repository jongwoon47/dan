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

function tradeFixture(stage: "received" | "connected" | "handoff") {
  const now = Date.now();
  const createdAt = new Date(now - 18 * 60 * 1000).toISOString();
  const future = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
  const paymentDueAt = new Date(now + 4 * 60 * 60 * 1000).toISOString();
  const lockedAt = new Date(now - 4 * 60 * 1000).toISOString();

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
    approxUsageCount: 2_400,
    conditionNote: "상태 좋음 · 상단 미세스크래치",
    status: stage === "received" ? "OPEN" : "MATCHED",
    createdAt,
  };

  const match = {
    id: "visual-match-x100vi",
    demandId: demand.id,
    sellIntentId: sell.id,
    productId: "prod-fuji-x100vi",
    buyerId: "user-you",
    sellerId: "user-jun",
    status: stage === "received" ? "BUYER_INTERESTED" : "CONNECTED",
    dealStage:
      stage === "received"
        ? "BUYER_INTERESTED"
        : stage === "handoff"
          ? "PAYMENT_PENDING"
          : "EVIDENCE_READY",
    paymentStatus: stage === "handoff" ? "PENDING" : "NOT_STARTED",
    paymentDueAt: stage === "handoff" ? paymentDueAt : undefined,
    createdAt,
  };

  const evidence = {
    id: "visual-evidence-x100vi",
    matchId: match.id,
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

  const snapshot =
    stage === "handoff"
      ? {
          id: "visual-snapshot-x100vi",
          matchId: match.id,
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
    matches: [match],
    dealEvidenceChallenges: [],
    dealEvidence: stage === "received" ? [] : [evidence],
    dealSnapshots: snapshot ? [snapshot] : [],
    dealDisputes: [],
  };
}

async function installTradeFixture(
  page: Page,
  stage: "received" | "connected" | "handoff",
) {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: STORE_KEY, value: tradeFixture(stage) },
  );
}

test("DAN V1 blueprint screens render on mobile", async ({ page }, testInfo) => {
  const outDir = path.join("qa-screenshots", "dan-v1", testInfo.project.name);
  mkdirSync(outDir, { recursive: true });

  await page.goto("/");
  await settle(page);
  await expect(
    page.getByRole("heading", { name: "지금 사고 있는 사람들" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /내 구매수요/ })).toBeVisible();
  await expect(page.getByText("Fujifilm X100VI").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "01-home-live-demand.png"),
    fullPage: true,
  });

  await page.goto("/buy/new");
  await settle(page);
  await expect(
    page.getByRole("heading", { name: "원하는 조건만 간단하게 남겨주세요." }),
  ).toBeVisible();
  await expect(page.getByText("필수 조건")).toBeVisible();
  await expect(page.getByText("선호 조건")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "02-create-demand.png"),
    fullPage: true,
  });

  await page.goto("/demand/prod-fuji-x100vi");
  await settle(page);
  await expect(page.getByText("Fujifilm X100VI").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "판매 제안하기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "03-live-demand-detail.png"),
    fullPage: true,
  });

  await page.goto("/demand/prod-fuji-x100vi/offer");
  await settle(page);
  await expect(page.getByText("Quick Offer", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "제안 보내기" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "04-quick-offer.png"),
    fullPage: true,
  });

  await page.goto("/profile/user-you");
  await settle(page);
  await expect(page.getByText("Trust History")).toBeVisible();
  await expect(page.getByText("사실 기반 거래 기록")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "05-trust-history.png"),
    fullPage: true,
  });

  await installTradeFixture(page, "received");
  await page.goto("/my");
  await settle(page);
  await expect(page.getByRole("heading", { name: "내 구매수요" })).toBeVisible();
  await expect(page.getByText("받은 제안 1")).toBeVisible();
  await expect(page.getByText("2,130,000원")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "06-received-offer.png"),
    fullPage: true,
  });

  await installTradeFixture(page, "connected");
  await page.goto("/deal/visual-match-x100vi/evidence");
  await settle(page);
  await expect(page.getByText("판매자가 제출한 정보예요")).toBeVisible();
  await expect(page.getByText("2,417컷")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "07-deal-evidence.png"),
    fullPage: true,
  });

  await page.goto("/deal/visual-match-x100vi/snapshot");
  await settle(page);
  await expect(page.getByText("Deal Snapshot", { exact: true })).toBeVisible();
  await expect(page.getByText("위 조건으로 거래를 진행합니다.")).toBeVisible();
  await expect(page.getByText("2024-03-15")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "08-deal-snapshot.png"),
    fullPage: true,
  });

  await installTradeFixture(page, "handoff");
  await page.goto("/deal/visual-match-x100vi/handoff");
  await settle(page);
  await expect(page.getByText("거래조건 확정")).toBeVisible();
  await expect(page.getByText("구매자 안전결제")).toBeVisible();
  await expect(page.getByText("직거래 · 인계 확인")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(outDir, "09-handoff-progress.png"),
    fullPage: true,
  });
});
