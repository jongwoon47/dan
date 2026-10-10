import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.VITE_SUPABASE_URL!;
export const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const appBaseUrl = process.env.DAN_E2E_BASE_URL ?? "http://127.0.0.1:5175";

export function datetimeLocal(hoursFromNow: number): string {
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

export function adminClient() {
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function completeRequiredConsent(page: Page) {
  await expect(page.getByRole("heading", { name: "DAN 시작하기" })).toBeVisible();
  const confirm = page.getByRole("button", { name: "동의하고 시작하기" });
  await expect(confirm).toBeDisabled();
  await page.locator("label").filter({ hasText: "전체 동의" }).click();
  await expect(page.getByRole("checkbox", { name: "전체 동의" })).toBeChecked();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page).not.toHaveURL(/\/consent(?:\?|$)/);
  await page.goto("/my");
  await expect(page.getByRole("heading", { name: "내 거래" })).toBeVisible();
}

export async function signupNamed(
  page: Page,
  tag: string,
  role: string,
  name: string,
) {
  const email = `dan.browser.qa.${role}.${tag}@example.com`;
  await page.goto("/login");
  await page.getByRole("button", { name: "계정이 없나요? 회원가입" }).click();
  await page.getByLabel("이름").fill(name);
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill("DanBrowserQa-Pass1!");
  await page.getByRole("button", { name: "가입하기" }).click();
  await completeRequiredConsent(page);
  return email;
}

export async function verifyUser(
  email: string,
  mode: "buyer" | "seller",
) {
  const admin = adminClient();
  const { data: users, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;
  const user = users.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error(`user not found: ${email}`);

  const { error } = await admin.rpc("ops_set_user_verification", {
    p_user_id: user.id,
    p_phone_verified: true,
    p_identity_verified: mode === "seller",
    p_payout_verified: mode === "seller",
    p_legal_name: mode === "seller" ? "Browser Seller" : "Browser Buyer",
    p_payout_account_ref: mode === "seller" ? "browser-e2e" : null,
    p_seller_type: mode === "seller" ? "INDIVIDUAL" : null,
  });
  if (error) throw error;
  return user.id;
}

export async function submitTask(page: Page, tag: string) {
  const title = `Browser QA Safety Task ${tag}`;
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

export async function submitBuy(page: Page, tag: string) {
  const title = `Browser QA Buy Camera ${tag}`;
  await page.goto("/create?type=BUY");
  await page.getByLabel("찾는 제품").fill(title);
  await page.getByLabel("희망 가격 (최대)").fill("850000");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "요청하기" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return title;
}

export async function respondToDemand(page: Page, demandPath: string, label: string) {
  await page.goto(demandPath);
  await page.getByRole("button", { name: "제가 할게요" }).click();
  await page.getByLabel("제안 금액").fill("15000");
  await page.getByLabel("가능한 시간/조건").fill("오늘 저녁 가능");
  await page.getByLabel("메시지").fill(`${label} 브라우저 QA 응답입니다`);
  await page.getByRole("button", { name: "응답 보내기" }).click();
  await expect(page.getByText("응답을 보냈어요")).toBeVisible();
}

/** 1x1 PNG for evidence photo upload. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function latestMatchIdForUser(userId: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("matches")
    .select("id,created_at")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("no match for user");
  return data.id as string;
}

/**
 * BUY quick offers are not persisted as matches until the buyer expresses
 * interest. Resolve the derived potential id from the buyer's active demand
 * and the newest OPEN sell intent on that product.
 */
export async function latestPotentialBuyOfferId(buyerId: string): Promise<string> {
  const admin = adminClient();
  const { data: demand, error: demandError } = await admin
    .from("demands")
    .select("id,product_id")
    .eq("user_id", buyerId)
    .eq("type", "BUY")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (demandError) throw demandError;
  if (!demand?.id || !demand.product_id) {
    throw new Error("no active BUY demand for buyer");
  }

  const { data: sell, error: sellError } = await admin
    .from("sell_intents")
    .select("id,created_at")
    .eq("status", "OPEN")
    .eq("product_id", demand.product_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sellError) throw sellError;
  if (!sell?.id) {
    throw new Error(
      `no OPEN sell intent for product ${demand.product_id} (demand ${demand.id})`,
    );
  }

  return `potential::${demand.id}::${sell.id}`;
}
