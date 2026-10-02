import { expect, test } from "@playwright/test";
import {
  acceptFirstOpenResponse,
  createBuyDemandV1,
  createTaskDemand,
  openFeedDemandByTitle,
  respondToDemand,
  signIn,
  uniqueTag,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("two-user TASK and BUY flows against live Supabase", async ({ browser }) => {
  test.setTimeout(300_000);
  test.skip(
    !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY,
    "Missing Supabase env",
  );
  test.skip(process.env.VITE_DATA_MODE === "demo", "Requires supabase data mode");

  const buyerEmail = process.env.DAN_E2E_BUYER_EMAIL;
  const buyerPassword = process.env.DAN_E2E_BUYER_PASSWORD;
  const sellerEmail = process.env.DAN_E2E_SELLER_EMAIL;
  const sellerPassword = process.env.DAN_E2E_SELLER_PASSWORD;
  test.skip(
    !buyerEmail || !buyerPassword || !sellerEmail || !sellerPassword,
    "Requires pre-verified staging buyer/seller accounts",
  );

  const tag = uniqueTag();
  const taskTitle = `E2E TASK ${tag}`;
  const productName = `E2E Product ${tag}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signIn(pageA, buyerEmail!, buyerPassword!);
  await signIn(pageB, sellerEmail!, sellerPassword!);

  // --- TASK: A creates → B responds → A accepts ---
  const taskUrl = await createTaskDemand(pageA, taskTitle);

  await openFeedDemandByTitle(pageB, taskTitle, "심부름");
  await respondToDemand(pageB, "근처라 바로 도와드릴 수 있어요");

  await pageA.goto(taskUrl);
  await pageA.reload();
  await acceptFirstOpenResponse(pageA);
  await expect(pageA.getByRole("button", { name: "보내기" })).toBeVisible();
  await expect(pageA.getByText(taskTitle)).toBeVisible();

  const taskMatchUrl = pageA.url();
  await pageA.getByLabel("메시지 입력").fill("E2E hello");
  await pageA.getByRole("button", { name: "보내기" }).click();
  await expect(pageA.getByText("E2E hello")).toBeVisible({ timeout: 20_000 });
  await pageB.goto(taskMatchUrl);
  await pageB.reload();
  await expect(pageB.getByText("E2E hello")).toBeVisible({ timeout: 20_000 });

  // --- BUY: A posts a verified demand → B targets that buyer with a low-friction Quick Offer ---
  await createBuyDemandV1(pageA, productName, "500000");

  await pageB.goto("/feed");
  await pageB.getByPlaceholder("제품, 지역, 키워드로 찾기").fill(productName);
  const productLink = pageB.getByRole("link").filter({ hasText: productName }).first();
  await expect(productLink).toBeVisible({ timeout: 30_000 });
  await productLink.click();

  const targetBuyer = pageB.getByRole("link", { name: "이 구매자에게 제안" }).first();
  await expect(targetBuyer).toBeVisible({ timeout: 30_000 });
  await targetBuyer.click();

  await pageB.getByRole("button", { name: "거의 새것" }).click();
  await pageB.getByLabel("희망 판매가").fill("400000");
  await pageB.getByRole("button", { name: "제안 보내기" }).click();
  await expect(pageB).toHaveURL(/\/my/, { timeout: 30_000 });

  // A expresses interest.
  await pageA.goto("/my?tab=offers");
  await pageA.reload();
  const offerDetail = pageA.getByRole("link", { name: "제안 상세 보기" }).first();
  await expect(offerDetail).toBeVisible({ timeout: 30_000 });
  await offerDetail.click();
  await pageA.getByRole("button", { name: "관심있어요" }).click();
  await expect(pageA.getByText("판매자에게 관심을 보냈어요")).toBeVisible({
    timeout: 20_000,
  });

  // B connects before detailed Evidence. Chat must be available immediately.
  await pageB.goto("/my?tab=selling");
  await pageB.reload();
  const connect = pageB.getByRole("button", {
    name: "구매자가 관심을 보였어요 · 연결하기",
  });
  await expect(connect).toBeVisible({ timeout: 30_000 });
  await connect.click();

  await pageB.goto("/chats");
  await pageB.reload();
  const buyChat = pageB.getByRole("link").filter({ hasText: productName }).first();
  await expect(buyChat).toBeVisible({ timeout: 30_000 });
  await buyChat.click();
  await expect(pageB.getByRole("button", { name: "보내기" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(pageB.getByText("판매자 Evidence가 필요해요")).toBeVisible();

  await pageB.getByLabel("메시지 입력").fill("연결됐어요. 상태를 먼저 확인해 주세요.");
  await pageB.getByRole("button", { name: "보내기" }).click();

  await pageA.goto("/chats");
  await pageA.reload();
  const buyerChat = pageA.getByRole("link").filter({ hasText: productName }).first();
  await expect(buyerChat).toBeVisible({ timeout: 30_000 });
  await buyerChat.click();
  await expect(pageA.getByText("연결됐어요. 상태를 먼저 확인해 주세요.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(pageA.getByText("판매자 Evidence가 필요해요")).toBeVisible();

  await contextA.close();
  await contextB.close();
});
