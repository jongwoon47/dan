import { expect, test, type Browser } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  TINY_PNG,
  appBaseUrl,
  assertSendMessageRejectedAsBlocked,
  latestPotentialBuyOfferId,
  markMatchPaidTrusted,
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
    const reportOwnerId = await verifyUser(reportOwnerEmail, "buyer");
    await verifyUser(reportPeerEmail, "buyer");

    await submitTask(report.ownerPage, `${tag}-report`);
    const reportDemandPath = new URL(report.ownerPage.url()).pathname;
    await respondToDemand(report.peerPage, reportDemandPath, "REPORT");
    await report.ownerPage.goto(reportDemandPath);
    await expect(report.ownerPage.getByText(reportPeer)).toBeVisible();
    await report.ownerPage.getByRole("button", { name: "수락" }).click();
    await expect(report.ownerPage).toHaveURL(/\/match\//);
    const reportMatchId = await waitForConnectedMatchId(reportOwnerId);

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

    // Server-side proof: peer RPC must fail with blocked and not insert a row.
    await assertSendMessageRejectedAsBlocked(reportPeerEmail, reportMatchId);

    // Browser proof: composer may accept input, but send surfaces block error
    // and the probe body never appears as a delivered bubble.
    const probe = `block-ui-probe-${tag}`;
    await report.peerPage.goto(`/match/${reportMatchId}`);
    await expect(report.peerPage.getByRole("button", { name: "보내기" })).toBeVisible({
      timeout: 45_000,
    });
    const composer = report.peerPage.locator(".chat-composer input");
    await expect(composer).toBeVisible({ timeout: 45_000 });
    await composer.fill(probe);
    await expect(composer).toHaveValue(probe);
    await report.peerPage.getByRole("button", { name: /보내기/ }).click();
    await expect(
      report.peerPage.getByText("차단된 상대에게는 메시지를 보낼 수 없어요."),
    ).toBeVisible({ timeout: 30_000 });
    // Probe may remain in the composer after a rejected send; it must not
    // appear as a delivered chat bubble in the thread.
    await expect(
      report.peerPage.locator(".chat-thread").getByText(probe, { exact: true }),
    ).toHaveCount(0);
    await report.peerPage.screenshot({
      path: path.join(outDir, "04-block-send-rejected.png"),
      fullPage: true,
    });
  } finally {
    await cancel.ownerContext.close();
    await cancel.peerContext.close();
    await report.ownerContext.close();
    await report.peerContext.close();
  }
});

test("BUY browser path: evidence→snapshot→payment honesty→ops paid→handoff→complete", async ({
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
    // Header + page title both use the product name — scope to main.
    await expect(
      sellerPage.getByRole("main").getByRole("heading", { name: title }),
    ).toBeVisible();
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
    const connectedMatchId = await waitForConnectedMatchId(buyerId);

    // Hydrate seller store via match chat, then open evidence with retries.
    let evidenceReady = false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await sellerPage.goto(`/match/${connectedMatchId}`);
      await expect(
        sellerPage.getByRole("link", { name: "상품 정보 등록" }),
      ).toBeVisible({ timeout: 60_000 });
      await sellerPage.getByRole("link", { name: "상품 정보 등록" }).click();
      await expect(sellerPage).toHaveURL(/\/evidence/);
      const formVisible = await sellerPage
        .getByText("현재 보유 사진 · 필수")
        .isVisible()
        .catch(() => false);
      if (!formVisible) {
        await sellerPage.goto("/my");
        continue;
      }

      const codeLocator = sellerPage.locator(".evidence-challenge-code strong");
      try {
        await expect
          .poll(
            async () => {
              if (await codeLocator.isVisible().catch(() => false)) return true;
              const retry = sellerPage.getByRole("button", {
                name: "새 코드 받기",
              });
              if (await retry.isVisible().catch(() => false)) {
                await retry.click();
              }
              return false;
            },
            { timeout: 45_000, intervals: [500, 750, 1000] },
          )
          .toBe(true);
        evidenceReady = true;
        break;
      } catch {
        await sellerPage.goto("/my");
      }
    }
    expect(evidenceReady, "evidence challenge did not issue after retries").toBe(
      true,
    );

    const fileInput = sellerPage.locator('input[type="file"]');
    await expect(fileInput).toBeEnabled({ timeout: 30_000 });
    await fileInput.setInputFiles({
      name: "evidence.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await sellerPage.getByLabel("외관 상태").fill("사용감 적음");
    await sellerPage.getByLabel("알려진 기능 이상").fill("없음");
    // Toggle at least one component chip if present (helps canSubmit).
    const componentChip = sellerPage.locator(".chip, .dan-chip, button").filter({
      hasText: /제품|본체|박스/,
    }).first();
    if (await componentChip.count()) {
      await componentChip.click().catch(() => undefined);
    }
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

    // Trusted ops settlement only — never click a fake client "pay" control.
    await markMatchPaidTrusted(connectedMatchId, `browser-buy-${tag}`);

    await buyerPage.goto(`/deal/${connectedMatchId}/handoff`);
    await expect(
      buyerPage.getByRole("button", { name: "물품을 확인했습니다" }),
    ).toBeVisible({ timeout: 90_000 });
    await buyerPage.getByRole("button", { name: "물품을 확인했습니다" }).click();
    await expect(buyerPage.getByText("상대 확인 대기 중")).toBeVisible({
      timeout: 45_000,
    });
    await buyerPage.screenshot({
      path: path.join(outDir, "05-handoff-buyer-confirmed.png"),
      fullPage: true,
    });

    await sellerPage.goto("/my");
    await sellerPage.goto(`/deal/${connectedMatchId}/handoff`);
    await expect(
      sellerPage.getByRole("button", { name: "제품 인도를 완료했습니다" }),
    ).toBeVisible({ timeout: 60_000 });
    await sellerPage.getByRole("button", { name: "제품 인도를 완료했습니다" }).click();
    await expect(sellerPage).toHaveURL(new RegExp(`/deal/${connectedMatchId}/complete`), {
      timeout: 60_000,
    });
    await expect(
      sellerPage.getByRole("heading", { name: /거래가 완료/ }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(sellerPage.getByText("800,000원").first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(sellerPage.getByText("확인 중")).toHaveCount(0);
    await sellerPage.screenshot({
      path: path.join(outDir, "06-handoff-completed.png"),
      fullPage: true,
    });

    await buyerPage.goto(`/deal/${connectedMatchId}/complete`);
    await expect(
      buyerPage.getByRole("heading", { name: /거래가 완료/ }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(buyerPage.getByText("800,000원").first()).toBeVisible({
      timeout: 30_000,
    });
  } finally {
    await ownerContext.close();
    await peerContext.close();
  }
});
