import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import {
  TINY_PNG,
  appBaseUrl,
  latestPotentialBuyOfferId,
  markMatchPaidTrusted,
  signupNamed,
  submitBuy,
  verifyUser,
  waitForConnectedMatchId,
} from "./helpers";

const mobileContext = {
  baseURL: appBaseUrl,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

export type BuyPaidDeal = {
  tag: string;
  buyerId: string;
  matchId: string;
  buyerPage: Page;
  sellerPage: Page;
  ownerContext: BrowserContext;
  peerContext: BrowserContext;
};

/**
 * Drive BUY through evidence → locked snapshot → payment honesty gate →
 * trusted ops PAID / HANDOFF_READY. Caller owns context cleanup.
 */
export async function prepareBuyPaidDeal(
  browser: Browser,
  tag: string,
  outDir: string,
): Promise<BuyPaidDeal> {
  const ownerContext = await browser.newContext(mobileContext);
  const peerContext = await browser.newContext(mobileContext);
  const buyerPage = await ownerContext.newPage();
  const sellerPage = await peerContext.newPage();

  const buyerName = `구매자${tag.slice(-4)}`;
  const sellerName = `판매자${tag.slice(-4)}`;
  const buyerEmail = await signupNamed(buyerPage, tag, "buyer", buyerName);
  const sellerEmail = await signupNamed(sellerPage, tag, "seller", sellerName);
  const buyerId = await verifyUser(buyerEmail, "buyer");
  await verifyUser(sellerEmail, "seller");

  const title = await submitBuy(buyerPage, tag);
  const demandPath = new URL(buyerPage.url()).pathname;
  const demandId = demandPath.split("/").pop()!;

  await sellerPage.goto(demandPath);
  await sellerPage.getByRole("link", { name: "가지고 있어요" }).click();
  await expect(
    sellerPage.getByRole("main").getByRole("heading", { name: title }),
  ).toBeVisible();
  const productPath = new URL(sellerPage.url()).pathname;
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
  const matchId = await waitForConnectedMatchId(buyerId);

  let evidenceReady = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await sellerPage.goto(`/match/${matchId}`);
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
  const componentChip = sellerPage
    .locator(".chip, .dan-chip, button")
    .filter({ hasText: /제품|본체|박스/ })
    .first();
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

  await buyerPage.goto(`/deal/${matchId}/snapshot`);
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

  await buyerPage.goto(`/deal/${matchId}/payment`);
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

  await buyerPage.goto(`/deal/${matchId}/handoff`);
  await expect(buyerPage.getByText("결제가 먼저 필요해요")).toBeVisible({
    timeout: 30_000,
  });
  await buyerPage.screenshot({
    path: path.join(outDir, "04-handoff-blocked.png"),
    fullPage: true,
  });

  await markMatchPaidTrusted(matchId, `browser-buy-${tag}`);

  return {
    tag,
    buyerId,
    matchId,
    buyerPage,
    sellerPage,
    ownerContext,
    peerContext,
  };
}
