import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

function datetimeLocal(hoursFromNow: number): string {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    d.getFullYear(),
    "-",
    pad(d.getMonth() + 1),
    "-",
    pad(d.getDate()),
    "T",
    pad(d.getHours()),
    ":",
    pad(d.getMinutes()),
  ].join("");
}

async function signup(page: Page, tag: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "계정이 없나요? 회원가입" }).click();
  await page.getByLabel("이름").fill("Browser QA");
  await page.getByLabel("이메일").fill(`dan.browser.qa.${tag}@example.com`);
  await page.getByLabel("비밀번호").fill("DanBrowserQa-Pass1!");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByRole("heading", { name: "무엇이 필요하세요?" })).toBeVisible();
}

async function submitBuy(page: Page, tag: string) {
  const title = `Browser QA Camera ${tag}`;
  await page.goto("/create?type=BUY");
  await page.getByLabel("찾는 제품").fill(title);
  await page.getByLabel("희망 가격 (최대)").fill("850000");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "요청하기" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return title;
}

async function submitBorrow(page: Page, tag: string) {
  const title = `Browser QA Tent ${tag}`;
  await page.goto("/create?type=BORROW");
  await page.getByLabel("물건").fill(title);
  await page.getByPlaceholder("예: 30,000").fill("30000");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByLabel("어디에서 받을까요?").fill("서울");
  await page.getByLabel("빌리는 시작").fill(datetimeLocal(48));
  await page.getByLabel("반납 예정").fill(datetimeLocal(72));
  await page.getByRole("button", { name: "요청하기" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return title;
}

async function submitTask(page: Page, tag: string) {
  const title = `Browser QA 서류 전달 ${tag}`;
  await page.goto("/create?type=TASK");
  await page.getByLabel("자세히").fill(title);
  await page.getByPlaceholder("예: 20,000").fill("20000");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "온라인으로 하기" }).click();
  await page.getByLabel("마감 시간").fill(datetimeLocal(48));
  await page.getByRole("button", { name: "요청하기" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return title;
}

async function submitService(page: Page, tag: string) {
  const title = `Browser QA 포트폴리오 피드백 ${tag}`;
  await page.goto("/create?type=SERVICE");
  await page.getByLabel("부탁할 일").fill(title);
  await page.getByPlaceholder("예: 1,000").fill("15000");
  await page.getByLabel("예상 소요시간").fill("30");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "온라인으로 가능" }).click();
  await page.getByLabel("희망 시간").fill(datetimeLocal(48));
  await page.getByRole("button", { name: "요청하기" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return title;
}

test("fresh Supabase user sees real zero states and can create all four request types", async ({ page }) => {
  const tag = String(Date.now());
  const outDir = path.join("qa-screenshots", "supabase-smoke");
  mkdirSync(outDir, { recursive: true });

  await signup(page, tag);

  await page.goto("/my");
  await expect(page.getByRole("heading", { name: "내 거래" })).toBeVisible();
  await expect(page.getByText("진행 중인 거래가 없어요")).toBeVisible();
  await page.getByRole("button", { name: /내 요청/ }).click();
  await expect(page.getByText("아직 올린 요청이 없어요")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "01-my-zero.png"), fullPage: true });

  await page.goto("/chats");
  await expect(page.getByText("아직 대화가 없어요")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "02-chats-zero.png"), fullPage: true });

  await page.goto("/activity");
  await expect(page.getByText("새로운 알림이 없어요.")).toBeVisible();
  await expect(page.getByText("새 응답, 거래 진행, 메시지 알림이 이곳에 모여요.")).toBeVisible();
  await page.screenshot({ path: path.join(outDir, "03-activity-zero.png"), fullPage: true });

  const titles = [
    await submitBuy(page, tag),
    await submitBorrow(page, tag),
    await submitTask(page, tag),
    await submitService(page, tag),
  ];

  await page.goto("/my?tab=requests");
  for (const title of titles) {
    await expect(page.getByText(title)).toBeVisible();
  }
  await page.screenshot({ path: path.join(outDir, "04-four-request-types.png"), fullPage: true });
});
