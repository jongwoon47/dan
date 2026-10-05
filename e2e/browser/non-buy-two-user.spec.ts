import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

const PASSWORD = "DanBrowserE2E-Pass1!";

function localDateTime(daysAhead: number, hour: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function signup(email: string, displayName: string) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  expect(data.user?.id).toBeTruthy();
  return data.user!;
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "무엇이 필요하세요?" })).toBeVisible();
}

type FlowType = "BORROW" | "TASK" | "SERVICE";

async function createDemandViaUi(page: Page, type: FlowType, tag: string) {
  await page.goto(`/create?type=${type}`);

  if (type === "BORROW") {
    const title = `E2E 텐트 ${tag}`;
    await page.getByLabel("물건").fill(title);
    await page.getByLabel("대여 총 예산").fill("30000");
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByLabel("어디에서 받을까요?").fill("서울 성동구");
    await page.getByLabel("빌리는 시작").fill(localDateTime(2, 10));
    await page.getByLabel("반납 예정").fill(localDateTime(3, 18));
    await page.getByRole("button", { name: "요청하기" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    return { title, url: page.url() };
  }

  if (type === "TASK") {
    const title = `E2E 서류 전달 ${tag}`;
    await page.getByLabel("자세히").fill(title);
    await page.getByLabel("보상").fill("20000");
    await page.getByRole("button", { name: "다음" }).click();
    await page.getByRole("button", { name: "온라인으로 하기" }).click();
    await page.getByLabel("마감 시간").fill(localDateTime(2, 19));
    await page.getByRole("button", { name: "요청하기" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    return { title, url: page.url() };
  }

  const title = `E2E 포트폴리오 피드백 ${tag}`;
  await page.getByLabel("부탁할 일").fill(title);
  await page.getByLabel("보상").fill("15000");
  await page.getByLabel("예상 소요시간").fill("30");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "온라인으로 가능" }).click();
  await page.getByLabel("희망 시간").fill(localDateTime(2, 20));
  await page.getByRole("button", { name: "요청하기" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return { title, url: page.url() };
}

async function respondViaUi(page: Page, demandUrl: string, label: string) {
  await page.goto(demandUrl);
  await page.getByRole("button", { name: "응답하기" }).click();
  await page.locator(".composer-sheet input[inputmode='numeric']").fill("12000");
  await page.getByLabel(/가능한 시간\/조건/).fill("오늘 저녁 가능");
  await page.getByLabel("메시지").fill(`${label} 응답 가능합니다`);
  await page.getByRole("button", { name: "응답 보내기" }).click();
  await expect(page.getByText("응답을 보냈어요")).toBeVisible();
}

async function acceptViaUi(page: Page, demandUrl: string, responseText: string) {
  await page.goto(demandUrl);
  await expect(page.getByText(responseText)).toBeVisible();
  await page.getByRole("button", { name: "수락" }).click();
  await expect(page).toHaveURL(/\/match\//);
  return new URL(page.url()).pathname;
}

async function sendChat(page: Page, body: string) {
  await page.locator(".chat-composer input").fill(body);
  await page.getByRole("button", { name: "보내기" }).click();
  await expect(page.getByText(body)).toBeVisible();
}

async function completeTrade(owner: Page, responder: Page) {
  await owner.getByRole("button", { name: "거래 완료" }).click();
  await owner.getByRole("button", { name: "완료 확인" }).click();
  await expect(owner.getByText("상대의 완료 확인을 기다리는 중이에요.")).toBeVisible();

  await responder.reload();
  await expect(responder.getByRole("button", { name: "나도 완료했어요" })).toBeVisible();
  await responder.getByRole("button", { name: "나도 완료했어요" }).click();
  await responder.getByRole("button", { name: "완료 확인" }).click();
  await expect(responder.getByText("거래가 완료됐어요")).toBeVisible();

  await owner.reload();
  await expect(owner.getByText("거래가 완료됐어요")).toBeVisible();
}

async function runFlow(browser: Browser, type: FlowType, index: number) {
  const tag = `${type.toLowerCase()}-${Date.now()}-${index}`;
  const ownerEmail = `dan.browser.owner.${tag}@example.com`;
  const responderEmail = `dan.browser.responder.${tag}@example.com`;

  await signup(ownerEmail, `Owner ${type}`);
  await signup(responderEmail, `Responder ${type}`);

  const ownerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const responderContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const owner = await ownerContext.newPage();
  const responder = await responderContext.newPage();

  try {
    await login(owner, ownerEmail);
    await login(responder, responderEmail);

    const created = await createDemandViaUi(owner, type, tag);
    const responseText = `${type} 응답 가능합니다`;

    await respondViaUi(responder, created.url, type);
    const chatPath = await acceptViaUi(owner, created.url, responseText);

    await responder.goto(chatPath);
    await expect(responder.locator(".chat-composer input")).toBeVisible();

    await sendChat(owner, `${type} 요청자 메시지`);
    await sendChat(responder, `${type} 응답자 메시지`);

    await owner.reload();
    await expect(owner.getByText(`${type} 응답자 메시지`)).toBeVisible();
    await responder.reload();
    await expect(responder.getByText(`${type} 요청자 메시지`)).toBeVisible();

    await completeTrade(owner, responder);
  } finally {
    await ownerContext.close();
    await responderContext.close();
  }
}

test.describe.serial("DAN non-BUY two-user browser E2E", () => {
  test("fresh account zero-data states render as finished product UI", async ({ browser }) => {
    const tag = Date.now();
    const email = `dan.browser.zero.${tag}@example.com`;
    await signup(email, "Zero User");

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await login(page, email);

      await page.goto("/my");
      await expect(page.getByText("진행 중인 거래가 없어요")).toBeVisible();

      await page.goto("/chats");
      await expect(page.getByText(/채팅|대화/).first()).toBeVisible();

      await page.goto("/activity");
      await expect(page.getByText("새 응답, 거래 진행, 메시지 알림이 이곳에 모여요.")).toBeVisible();
      await expect(page.getByRole("link", { name: "요청 둘러보기" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  for (const [index, type] of (["BORROW", "TASK", "SERVICE"] as const).entries()) {
    test(`${type} UI create → response → chat → completion`, async ({ browser }) => {
      await runFlow(browser, type, index);
    });
  }
});
