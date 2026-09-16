import { expect, test } from "@playwright/test";
import {
  acceptFirstOpenResponse,
  createBuyDemand,
  createTaskDemand,
  openFeedDemandByTitle,
  respondToDemand,
  signUp,
  uniqueTag,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("two-user TASK and BUY flows against live Supabase", async ({ browser }) => {
  test.setTimeout(240_000);
  test.skip(
    !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY,
    "Missing Supabase env",
  );
  test.skip(process.env.VITE_DATA_MODE === "demo", "Requires supabase data mode");

  const tag = uniqueTag();
  const emailA = `dan.browser.a.${tag}@example.com`;
  const emailB = `dan.browser.b.${tag}@example.com`;
  const taskTitle = `E2E TASK ${tag}`;
  const productName = `E2E Cam ${tag}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signUp(pageA, emailA, "Browser A");
  await signUp(pageB, emailB, "Browser B");

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

  // --- BUY: A creates → B owns + sell intent → A interest → B connect ---
  await createBuyDemand(pageA, productName, "500000");

  await openFeedDemandByTitle(pageB, productName, "물건 구매");
  await pageB.getByRole("link", { name: "가지고 있어요" }).click();
  await expect(pageB).toHaveURL(/\/demand\/.+\/own/);
  await pageB.getByRole("button", { name: "거의 새것" }).click();
  await pageB.getByRole("button", { name: "내 물건으로 등록" }).click();
  await expect(pageB.getByRole("heading", { name: "등록했어요" })).toBeVisible({
    timeout: 20_000,
  });
  await pageB.getByRole("button", { name: "이 가격이면 팔 수도 있어요" }).click();
  await expect(pageB).toHaveURL(/\/ownership\/.+\/sell-intent/);
  await pageB.getByLabel("최소 희망가").fill("400000");
  await pageB.getByRole("button", { name: "이 가격이면 팔 수도 있어요" }).click();
  await expect(pageB).toHaveURL(/\/(my|chats)/, { timeout: 30_000 });

  await pageA.goto("/my");
  await pageA.reload();
  await expect(pageA.getByText(productName).first()).toBeVisible({ timeout: 30_000 });
  await pageA.getByRole("button", { name: "거래 의사 보내기" }).click();
  await expect(pageA.getByText("상대 응답 대기")).toBeVisible({ timeout: 20_000 });

  await pageB.goto("/my");
  await pageB.reload();
  await pageB.getByRole("button", { name: "연결하기" }).click();
  await expect(pageB.getByRole("button", { name: "연결하기" })).toHaveCount(0, {
    timeout: 20_000,
  });
  await pageB.goto("/chats");
  await pageB.reload();
  const buyChat = pageB
    .getByRole("link", { name: /Browser A/ })
    .filter({ hasText: "대화를 시작해 보세요" });
  await expect(buyChat).toBeVisible({ timeout: 30_000 });
  await buyChat.click();
  await expect(pageB.getByRole("button", { name: "보내기" })).toBeVisible({
    timeout: 20_000,
  });

  await pageA.goto("/chats");
  await pageA.reload();
  await expect(pageA.getByRole("link", { name: /Browser B/ }).first()).toBeVisible({
    timeout: 20_000,
  });

  await contextA.close();
  await contextB.close();
});
