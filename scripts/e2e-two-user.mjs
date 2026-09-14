/**
 * Live 2-user E2E against remote Supabase (Usability V1).
 * Run: npm run test:e2e:remote
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const mode = process.env.VITE_DATA_MODE;

if (!url || !key) {
  console.error("FAIL: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}
if (mode === "demo") {
  console.error("FAIL: VITE_DATA_MODE=demo");
  process.exit(1);
}

const ts = Date.now();
const password = "DanE2eLive-Pass1!";
const emailA = `dan.e2e.a.${ts}@example.com`;
const emailB = `dan.e2e.b.${ts}@example.com`;
const emailC = `dan.e2e.c.${ts}@example.com`;

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function log(step, detail) {
  console.log(`[${step}]`, detail ?? "");
}

async function signup(sb, email, name) {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) throw error;
  assert(data.session, `no session after signup ${email}`);
  return data.session.user;
}

const report = {
  task: "FAIL",
  buy: "FAIL",
  security: "FAIL",
  chat: "FAIL",
  autoDecline: "FAIL",
  potentialPersisted: "UNKNOWN",
  demoFallback: "NO",
};

try {
  const a = client();
  const b = client();
  const c = client();
  const userA = await signup(a, emailA, "E2E A");
  const userB = await signup(b, emailB, "E2E B");
  const userC = await signup(c, emailC, "E2E C");
  log("auth", { a: userA.id, b: userB.id, c: userC.id });

  // TASK + dual responses + accept auto-decline
  const taskInsert = await a
    .from("demands")
    .insert({
      user_id: userA.id,
      type: "TASK",
      title: "E2E UX 픽업",
      description: "평택역 → 고덕",
      category: "errand",
      budget: 20000,
      location: "평택역 → 고덕",
      fulfillment_options: [
        {
          mode: "ROUTE",
          from: { publicLabel: "평택역" },
          to: { publicLabel: "고덕" },
        },
      ],
      status: "ACTIVE",
      task_description: "서류 픽업",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    .select("*")
    .single();
  if (taskInsert.error) throw taskInsert.error;
  const taskId = taskInsert.data.id;

  const r1 = await b.rpc("upsert_response", {
    p_demand_id: taskId,
    p_message: "근처라 바로 갈 수 있어요",
    p_offered_price: 15000,
    p_availability_text: "오늘 19:30 이후",
  });
  if (r1.error) throw r1.error;

  const r2 = await c.rpc("upsert_response", {
    p_demand_id: taskId,
    p_message: "차량 있습니다",
    p_offered_price: 18000,
    p_availability_text: "오늘 18:00",
  });
  if (r2.error) throw r2.error;

  const accept = await a.rpc("accept_response", { p_response_id: r1.data.id });
  if (accept.error) throw accept.error;
  assert(accept.data.status === "CONNECTED", "TASK not CONNECTED");

  const other = await c
    .from("responses")
    .select("status")
    .eq("id", r2.data.id)
    .single();
  assert(other.data.status === "DECLINED", "other OPEN should be DECLINED");
  report.autoDecline = "PASS";

  // Chat
  const m1 = await a.rpc("send_message", {
    p_match_id: accept.data.id,
    p_body: "평택역 1번 출구에서 만나요",
  });
  if (m1.error) throw m1.error;
  const m2 = await b.rpc("send_message", {
    p_match_id: accept.data.id,
    p_body: "네, 19:40에 갈게요",
  });
  if (m2.error) throw m2.error;
  const msgs = await a
    .from("messages")
    .select("id")
    .eq("match_id", accept.data.id);
  assert((msgs.data ?? []).length >= 2, "chat messages missing");
  const cChat = await c.from("messages").select("id").eq("match_id", accept.data.id);
  assert((cChat.data ?? []).length === 0, "C should not read chat");
  report.chat = "PASS";
  report.task = "PASS";
  log("TASK+chat", "PASS");

  // BUY
  const products = await a.from("products").select("id,canonical_name").limit(1);
  const productId = products.data[0].id;
  const buyRpc = await a.rpc("upsert_buy_demand", {
    p_product_id: productId,
    p_title: "E2E BUY",
    p_description: "buy",
    p_category: "electronics",
    p_max_price: 1_500_000,
    p_location: "택배",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
  if (buyRpc.error) throw buyRpc.error;

  const before = await a.from("matches").select("id").eq("demand_id", buyRpc.data.id);
  assert((before.data ?? []).length === 0, "POTENTIAL persisted");
  report.potentialPersisted = "NO";

  const own = await b
    .from("ownerships")
    .insert({
      user_id: userB.id,
      product_id: productId,
      condition: "like_new",
      status: "OWNED",
    })
    .select("*")
    .single();
  if (own.error) throw own.error;
  const sell = await b
    .from("sell_intents")
    .insert({
      ownership_id: own.data.id,
      user_id: userB.id,
      product_id: productId,
      minimum_price: 1_200_000,
      status: "OPEN",
    })
    .select("*")
    .single();
  if (sell.error) throw sell.error;

  const interest = await a.rpc("express_buyer_interest", {
    p_demand_id: buyRpc.data.id,
    p_sell_intent_id: sell.data.id,
  });
  if (interest.error) throw interest.error;
  assert(interest.data.status === "BUYER_INTERESTED", "interest");
  const connect = await b.rpc("seller_connect_match", {
    p_match_id: interest.data.id,
  });
  if (connect.error) throw connect.error;
  assert(connect.data.status === "CONNECTED", "buy connect");
  report.buy = "PASS";

  // Security
  const steal = await b
    .from("demands")
    .update({ title: "HACKED" })
    .eq("id", taskId)
    .select("*");
  assert(!(steal.data ?? []).length, "B edited A demand");
  const early = await b.rpc("seller_connect_match", {
    p_match_id: "00000000-0000-0000-0000-000000000001",
  });
  assert(early.error, "early connect");
  report.security = "PASS";

  // Block prevents message
  const block = await a.from("blocks").insert({
    blocker_id: userA.id,
    blocked_id: userB.id,
  });
  if (block.error) throw block.error;
  const blockedMsg = await b.rpc("send_message", {
    p_match_id: accept.data.id,
    p_body: "should fail",
  });
  assert(blockedMsg.error, "blocked message should fail");

  console.log(
    JSON.stringify(
      {
        TASK: report.task,
        BUY: report.buy,
        Security: report.security,
        Chat: report.chat,
        AutoDecline: report.autoDecline,
        POTENTIAL_persisted: report.potentialPersisted,
        Demo_fallback: report.demoFallback,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("E2E FAILED:", e.message || e);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
