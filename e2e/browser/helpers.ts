import { expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "DanE2eLive-Pass1!";

export function uniqueTag() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

export function futureDatetimeLocal(daysAhead = 7) {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function signUp(page: Page, email: string, displayName: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "계정이 없나요? 회원가입" }).click();
  await page.getByLabel("이름").fill(displayName);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export async function createTaskDemand(page: Page, title: string) {
  await page.goto("/create?type=TASK");
  await page.getByRole("radio", { name: "심부름" }).click();
  await page.getByLabel("요청 제목").fill(title);
  await page.getByLabel("자세히").fill("E2E TASK detail");
  await page.getByLabel("보상").fill("15000");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "온라인으로 가능" }).click();
  await page.getByLabel("마감 시간").fill(futureDatetimeLocal());
  await page.getByRole("button", { name: "요청 등록" }).click();
  await expect(page).toHaveURL(/\/demand\/item\//, { timeout: 30_000 });
  return page.url();
}

export async function createBuyDemand(page: Page, productName: string, maxPrice: string) {
  await page.goto("/create?type=BUY");
  await page.getByRole("radio", { name: "물건 구매" }).click();
  await page.getByLabel("찾는 제품").fill(productName);
  await page.getByLabel("희망 가격 (최대)").fill(maxPrice);
  await page.getByRole("button", { name: "다음" }).click();
  // Default is shipping on — do not toggle it off.
  const shipping = page.getByRole("button", { name: "택배 가능" });
  if ((await shipping.getAttribute("aria-pressed")) !== "true") {
    await shipping.click();
  }
  await page.getByRole("button", { name: "요청 등록" }).click();
  await expect(page).toHaveURL(/\/demand\/item\//, { timeout: 30_000 });
  return page.url();
}

export async function openFeedDemandByTitle(page: Page, title: string, typeFilter?: string) {
  await page.goto("/feed");
  if (typeFilter) {
    await page.getByRole("toolbar", { name: "유형 필터" }).getByRole("button", { name: typeFilter }).click();
  }
  await page.getByPlaceholder("제목, 지역, 키워드").fill(title);
  const link = page.getByRole("link").filter({ hasText: title }).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();
}

export async function respondToDemand(page: Page, message: string) {
  await page.getByRole("button", { name: "이 필요에 응답하기" }).click();
  await page.locator("textarea").fill(message);
  await page.getByRole("button", { name: "응답 보내기" }).click();
  await expect(page.getByText("응답을 보냈어요")).toBeVisible({ timeout: 20_000 });
}

export async function acceptFirstOpenResponse(page: Page) {
  await page.getByRole("button", { name: "수락" }).first().click();
  await expect(page).toHaveURL(/\/match\//, { timeout: 30_000 });
}
