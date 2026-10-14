import { expect, test, type Browser } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { prepareBuyPaidDeal } from "./buyDealSetup";
import {
  appBaseUrl,
  assertSendMessageRejectedAsBlocked,
  respondToDemand,
  signupNamed,
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

  const deal = await prepareBuyPaidDeal(browser, tag, outDir);
  const { buyerPage, sellerPage, matchId, ownerContext, peerContext } = deal;

  try {
    await buyerPage.goto(`/deal/${matchId}/handoff`);
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
    await sellerPage.goto(`/deal/${matchId}/handoff`);
    await expect(
      sellerPage.getByRole("button", { name: "제품 인도를 완료했습니다" }),
    ).toBeVisible({ timeout: 60_000 });
    await sellerPage.getByRole("button", { name: "제품 인도를 완료했습니다" }).click();
    await expect(sellerPage).toHaveURL(new RegExp(`/deal/${matchId}/complete`), {
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

    await buyerPage.goto(`/deal/${matchId}/complete`);
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

test("BUY browser path: ops paid→open dispute pauses handoff completion", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const tag = `d${String(Date.now())}`;
  const outDir = path.join("qa-screenshots", "supabase-buy-dispute");
  mkdirSync(outDir, { recursive: true });

  const deal = await prepareBuyPaidDeal(browser, tag, outDir);
  const { buyerPage, matchId, ownerContext, peerContext } = deal;

  try {
    await buyerPage.goto(`/deal/${matchId}/handoff`);
    await expect(
      buyerPage.getByRole("button", { name: "물품을 확인했습니다" }),
    ).toBeVisible({ timeout: 90_000 });

    await buyerPage.getByText("거래 조건과 다르거나 문제가 있나요?").click();
    await buyerPage.getByRole("button", { name: "다른 물건이에요" }).click();
    await buyerPage
      .getByPlaceholder("확인한 문제를 구체적으로 적어주세요.")
      .fill(`dispute-browser-${tag}`);
    await buyerPage
      .getByRole("button", { name: "거래 중지하고 분쟁 접수" })
      .click();

    await expect(
      buyerPage.getByText("거래가 분쟁 검토 상태예요"),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      buyerPage.getByRole("button", { name: "물품을 확인했습니다" }),
    ).toHaveCount(0);
    await expect(buyerPage.getByText("다른 물건이에요")).toBeVisible();
    await buyerPage.screenshot({
      path: path.join(outDir, "05-dispute-paused.png"),
      fullPage: true,
    });
  } finally {
    await ownerContext.close();
    await peerContext.close();
  }
});
