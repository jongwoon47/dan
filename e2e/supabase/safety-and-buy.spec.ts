import { expect, test, type Browser } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  TINY_PNG,
  appBaseUrl,
  latestPotentialBuyOfferId,
  respondToDemand,
  signupNamed,
  submitBuy,
  submitTask,
  verifyUser,
  waitForConnectedMatchId,
} from "./helpers";

const mobileContext = {
  baseURL: appBaseUrl,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

async function twoPages(browser: Browser) {
  const ownerContext = await browser.newContext(mobileContext);
  const peerContext = await browser.newContext(mobileContext);
  return {
    ownerContext,
    peerContext,
    ownerPage: await ownerContext.newPage(),
    peerPage: await peerContext.newPage(),
  };
}

test("two users can report, block, and cancel a connected TASK trade in the browser", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const tag = String(Date.now());
  const outDir = path.join("qa-screenshots", "supabase-safety");
  mkdirSync(outDir, { recursive: true });

  const cancel = await twoPages(browser);
  const report = await twoPages(browser);

  try {
    const cancelOwner = `취소자${tag.slice(-4)}`;
    const cancelPeer = `응답취${tag.slice(-4)}`;
    const cancelOwnerEmail = await signupNamed(
      cancel.ownerPage,
      `${tag}-c`,
      "owner",
      cancelOwner,
    );
    const cancelPeerEmail = await signupNamed(
      cancel.peerPage,
      `${tag}-c`,
      "peer",
      cancelPeer,
    );
    await verifyUser(cancelOwnerEmail, "buyer");
    await verifyUser(cancelPeerEmail, "buyer");

    await submitTask(cancel.ownerPage, `${tag}-cancel`);
    const cancelDemandPath = new URL(cancel.ownerPage.url()).pathname;
    await respondToDemand(cancel.peerPage, cancelDemandPath, "CANCEL");
    await cancel.ownerPage.goto(cancelDemandPath);
    await expect(cancel.ownerPage.getByText(cancelPeer)).toBeVisible();
    await cancel.ownerPage.getByRole("button", { name: "수락" }).click();
    await expect(cancel.ownerPage).toHaveURL(/\/match\//);

    await cancel.ownerPage.getByRole("button", { name: "거래하지 않기로 했어요" }).click();
    await expect(
      cancel.ownerPage.getByRole("heading", { name: "이 거래를 종료할까요?" }),
    ).toBeVisible();
    await cancel.ownerPage.getByRole("button", { name: "거래 종료" }).click();
    await expect(
      cancel.ownerPage.getByRole("heading", { name: "이 거래를 종료할까요?" }),
    ).toHaveCount(0, { timeout: 30_000 });
    await expect(cancel.ownerPage.getByText("거래가 종료됐어요")).toBeVisible({
      timeout: 30_000,
    });
    await cancel.ownerPage.screenshot({
      path: path.join(outDir, "01-cancel.png"),
      fullPage: true,
    });

    const reportOwner = `신고자${tag.slice(-4)}`;
    const reportPeer = `피신고${tag.slice(-4)}`;
    const reportOwnerEmail = await signupNamed(
      report.ownerPage,
      `${tag}-r`,
      "owner",
      reportOwner,
    );
    const reportPeerEmail = await signupNamed(
      report.peerPage,
      `${tag}-r`,
      "peer",
      reportPeer,
    );
    await verifyUser(reportOwnerEmail, "buyer");
    await verifyUser(reportPeerEmail, "buyer");

    await submitTask(report.ownerPage, `${tag}-report`);
    const reportDemandPath = new URL(report.ownerPage.url()).pathname;
    await respondToDemand(report.peerPage, reportDemandPath, "REPORT");
    await report.ownerPage.goto(reportDemandPath);
    await expect(report.ownerPage.getByText(reportPeer)).toBeVisible();
    await report.ownerPage.getByRole("button", { name: "수락" }).click();
    await expect(report.ownerPage).toHaveURL(/\/match\//);

    await report.ownerPage.getByRole("button", { name: "더보기" }).click();
    await report.ownerPage.getByRole("menuitem", { name: "신고" }).click();
    await expect(report.ownerPage.getByText("신고 사유")).toBeVisible();
    await report.ownerPage.getByRole("button", { name: "스팸" }).click();
    await report.ownerPage.getByRole("button", { name: "신고하기" }).click();
    await expect(report.ownerPage.getByText("신고가 접수됐어요")).toBeVisible({
      timeout: 30_000,
    });
    await report.ownerPage.screenshot({
      path: path.join(outDir, "02-report.png"),
      fullPage: true,
    });

    await report.ownerPage.getByRole("button", { name: "더보기" }).click();
    await report.ownerPage.getByRole("menuitem", { name: "차단" }).click();
    await expect(
      report.ownerPage.getByText("이 사용자를 차단할까요?"),
    ).toBeVisible();
    await report.ownerPage.getByRole("button", { name: "차단" }).click();
    await expect(report.ownerPage.getByText("차단했어요")).toBeVisible({
      timeout: 30_000,
    });
    await report.ownerPage.screenshot({
      path: path.join(outDir, "03-block.png"),
      fullPage: true,
    });

    await report.peerPage.goto("/chats");
    const row = report.peerPage
      .locator("a.chat-list__row")
      .filter({ hasText: /Browser QA Safety Task/ });
    await expect(row.first()).toBeVisible({ timeout: 30_000 });
    await row.first().click();
    const composer = report.peerPage.getByLabel("메시지 입력");
    if (await composer.isVisible().catch(() => false)) {
      await composer.fill("차단 이후 메시지");
      await report.peerPage.getByRole("button", { name: "보내기" }).click();
      await expect(
        report.peerPage.getByText(/차단|보낼 수 없|실패|금지|잠시/),
      ).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(
        report.peerPage.getByText(/종료|차단|닫힌|완료|읽기/),
      ).toBeVisible();
    }
  } finally {
    await cancel.ownerContext.close();
    await cancel.peerContext.close();
    await report.ownerContext.close();
    await report.peerContext.close();
  }
});

test("BUY browser path reaches evidence→snapshot→payment honesty gate (no fake pay)", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const tag = String(Date.now());
  const outDir = path.join("qa-screenshots", "supabase-buy-deal");
  mkdirSync(outDir, { recursive: true });

  const { ownerContext, peerContext, ownerPage: buyerPage, peerPage: sellerPage } =
    await twoPages(browser);

  try {
    const buyerName = `구매자${tag.slice(-4)}`;
    const sellerName = `판매자${tag.slice(-4)}`;
    const buyerEmail = await signupNamed(buyerPage, tag, "buyer", buyerName);
    const sellerEmail = await signupNamed(sellerPage, tag, "seller", sellerName);
    const buyerId = await verifyUser(buyerEmail, "buyer");
    await verifyUser(sellerEmail, "seller");

    const title = await submitBuy(buyerPage, tag);
    const demandPath = new URL(buyerPage.url()).pathname;

    // Seller: demand item → product detail → quick offer (condition required)
    const demandId = demandPath.split("/").pop()!;
    await sellerPage.goto(demandPath);
    await sellerPage.getByRole("link", { name: "가지고 있어요" }).click();
    await expect(sellerPage.getByRole("heading", { name: title })).toBeVisible();
    // Prefer target-bound offer so the sell intent links to this BUY demand.
    const productPath = new URL(sellerPage.url()).pathname; // /demand/:productId
    await sellerPage.goto(`${productPath}/offer?target=${encodeURIComponent(demandId)}`);
    await expect(sellerPage.getByLabel("희망 판매가")).toBeVisible({
      timeout: 30_000,
    });
    await sellerPage.getByLabel("희망 판매가").fill("800000");
    await sellerPage.getByRole("button", { name: "거의 새것" }).click();
    await sellerPage.getByRole("button", { name: "제안 보내기" }).click();
    await expect(sellerPage).toHaveURL(/\/my/, { timeout: 45_000 });
    await sellerPage.screenshot({
      path: path.join(outDir, "00-offer-sent.png"),
      fullPage: true,
    });

    const potentialOfferId = await latestPotentialBuyOfferId(buyerId);

    await buyerPage.goto(`/offer/${potentialOfferId}`);
    await buyerPage.getByRole("button", { name: "이 제안 선택하기" }).click();
    await expect(buyerPage.getByText("제안을 선택했어요")).toBeVisible({
      timeout: 45_000,
    });

    await sellerPage.goto("/my");
    await expect(
      sellerPage.getByRole("button", { name: "구매자와 연결하기" }),
    ).toBeVisible({ timeout: 45_000 });
    await sellerPage.getByRole("button", { name: "구매자와 연결하기" }).click();
    // Connect does not auto-navigate; wait until status is CONNECTED in DB.
    await expect.poll(async () => {
      const admin = (await import("./helpers")).adminClient();
      const { data } = await admin
        .from("matches")
        .select("id,status")
        .eq("buyer_id", buyerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.status === "CONNECTED" ? data.id : "";
    }, { timeout: 60_000 }).not.toEqual("");
    const connectedMatchId = await latestMatchIdForUser(buyerId);

    // Load match chat first so the store hydrates sell intent + demand rows.
    await sellerPage.goto(`/match/${connectedMatchId}`);
    await expect(
      sellerPage.getByRole("link", { name: "상품 정보 등록" }),
    ).toBeVisible({ timeout: 60_000 });
    await sellerPage.getByRole("link", { name: "상품 정보 등록" }).click();
    await expect(sellerPage).toHaveURL(/\/evidence/);
    await expect(sellerPage.getByText("거래 정보를 찾을 수 없어요")).toHaveCount(0);
    await expect(sellerPage.getByText(/촬영 코드|현재 보유/)).toBeVisible({
      timeout: 60_000,
    });
    const fileInput = sellerPage.locator('input[type="file"]');
    await expect(fileInput).toBeEnabled({ timeout: 60_000 });
    await fileInput.setInputFiles({
      name: "evidence.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await sellerPage.getByLabel(/외관/).fill("사용감 적음");
    await sellerPage.getByLabel(/알려진 기능 이상|기능 이상/).fill("없음");
    await sellerPage.getByRole("button", { name: "상품 정보 저장하기" }).click();
    await expect(sellerPage).toHaveURL(/\/snapshot/, { timeout: 60_000 });
    await sellerPage.screenshot({
      path: path.join(outDir, "01-evidence-to-snapshot.png"),
      fullPage: true,
    });

    const sellerConfirm = sellerPage.getByRole("button", { name: "거래 조건 확인" });
    await expect(sellerConfirm).toBeVisible({ timeout: 30_000 });
    await sellerConfirm.click();
    await expect(sellerPage.getByText(/상대 확인 대기|확정/)).toBeVisible({
      timeout: 45_000,
    });

    await buyerPage.goto(`/deal/${connectedMatchId}/snapshot`);
    const buyerConfirm = buyerPage.getByRole("button", { name: "거래 조건 확인" });
    await expect(buyerConfirm).toBeVisible({ timeout: 30_000 });
    await buyerConfirm.click();
    await expect(buyerPage.getByText("거래 조건이 확정됐어요")).toBeVisible({
      timeout: 60_000,
    });
    await buyerPage.screenshot({
      path: path.join(outDir, "02-snapshot-locked.png"),
      fullPage: true,
    });

    await buyerPage.goto(`/deal/${connectedMatchId}/payment`);
    await expect(
      buyerPage.getByRole("heading", {
        name: "현재는 실제 결제를 받을 수 없어요.",
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      buyerPage.getByRole("button", { name: /결제하기|원 결제/ }),
    ).toHaveCount(0);
    await buyerPage.screenshot({
      path: path.join(outDir, "03-payment-gate.png"),
      fullPage: true,
    });

    await buyerPage.goto(`/deal/${connectedMatchId}/handoff`);
    await expect(buyerPage.getByText("결제가 먼저 필요해요")).toBeVisible({
      timeout: 30_000,
    });
    await buyerPage.screenshot({
      path: path.join(outDir, "04-handoff-blocked.png"),
      fullPage: true,
    });
  } finally {
    await ownerContext.close();
    await peerContext.close();
  }
});
