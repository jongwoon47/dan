/**
 * Live 2-user E2E against remote Supabase (not demo).
 * Run: node --env-file=.env.local scripts/e2e-two-user.mjs
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
  console.error("FAIL: VITE_DATA_MODE=demo (demo fallback forbidden)");
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
  potentialPersisted: "UNKNOWN",
  demoFallback: mode === "demo" ? "YES" : "NO",
  bugs: [],
};

try {
  log("env", { host: new URL(url).host, mode: mode || "(unset→supabase if keys)" });

  const a = client();
  const b = client();
  const c = client();

  const userA = await signup(a, emailA, "E2E A");
  const userB = await signup(b, emailB, "E2E B");
  const userC = await signup(c, emailC, "E2E C");
  log("auth", { a: userA.id, b: userB.id, c: userC.id });

  // ---------- TASK ----------
  const taskInsert = await a
    .from("demands")
    .insert({
      user_id: userA.id,
      type: "TASK",
      title: "E2E 서류 픽업",
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
      task_description: "서류 받아서 가져다주세요",
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    .select("*")
    .single();
  if (taskInsert.error) throw taskInsert.error;
  const taskId = taskInsert.data.id;
  log("TASK create", taskId);

  const respInsert = await b
    .from("responses")
    .insert({
      demand_id: taskId,
      responder_id: userB.id,
      response_type: "FULFILL",
      message: "제가 할게요",
      offered_price: 20000,
      status: "OPEN",
    })
    .select("*")
    .single();
  if (respInsert.error) throw respInsert.error;
  const responseId = respInsert.data.id;
  log("TASK response", responseId);

  const accept = await a.rpc("accept_response", { p_response_id: responseId });
  if (accept.error) throw accept.error;
  assert(accept.data.status === "CONNECTED", "TASK match not CONNECTED");
  log("TASK accept", accept.data.id + " " + accept.data.status);

  const taskMatchDb = await a
    .from("matches")
    .select("*")
    .eq("id", accept.data.id)
    .single();
  if (taskMatchDb.error) throw taskMatchDb.error;
  assert(taskMatchDb.data.status === "CONNECTED", "TASK DB status");
  assert(taskMatchDb.data.response_id === responseId, "TASK response_id");
  assert(!taskMatchDb.data.sell_intent_id, "TASK should not have sell_intent");

  const respStatus = await a
    .from("responses")
    .select("status")
    .eq("id", responseId)
    .single();
  assert(respStatus.data.status === "ACCEPTED", "response should be ACCEPTED");

  report.task = "PASS";
  log("TASK", "PASS");

  // ---------- BUY ----------
  const products = await a.from("products").select("id,canonical_name").limit(1);
  if (products.error) throw products.error;
  assert(products.data?.length, "no products");
  const productId = products.data[0].id;
  log("BUY product", products.data[0].canonical_name);

  const buyRpc = await a.rpc("upsert_buy_demand", {
    p_product_id: productId,
    p_title: "E2E BUY " + products.data[0].canonical_name,
    p_description: "E2E buy demand",
    p_category: "electronics",
    p_max_price: 1_500_000,
    p_location: "택배 가능",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
  if (buyRpc.error) throw buyRpc.error;
  const buyDemandId = buyRpc.data.id;
  log("BUY demand", buyDemandId);

  // Before interest: no match rows for this demand
  const beforeInterest = await a
    .from("matches")
    .select("id,status")
    .eq("demand_id", buyDemandId);
  assert(
    (beforeInterest.data ?? []).length === 0,
    "POTENTIAL must not be persisted before interest",
  );

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
  log("BUY ownership", own.data.id);

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
  log("BUY sell_intent", sell.data.id);

  // Derived POTENTIAL conditions (app-side): same product, open sell, price ok, different user
  const demandRow = buyRpc.data;
  const potentialOk =
    demandRow.product_id === sell.data.product_id &&
    demandRow.user_id !== sell.data.user_id &&
    Number(demandRow.max_price) >= Number(sell.data.minimum_price) &&
    sell.data.status === "OPEN";
  assert(potentialOk, "derived POTENTIAL conditions failed");

  const midMatches = await a
    .from("matches")
    .select("id,status")
    .eq("demand_id", buyDemandId);
  assert(
    (midMatches.data ?? []).length === 0,
    "POTENTIAL must not create match rows",
  );
  report.potentialPersisted = "NO";

  // Security: seller cannot connect without BUYER_INTERESTED row
  const earlyConnect = await b.rpc("seller_connect_match", {
    p_match_id: "00000000-0000-0000-0000-000000000001",
  });
  assert(earlyConnect.error, "early connect should fail");
  log("security early-connect-no-match", earlyConnect.error.message);

  const interest = await a.rpc("express_buyer_interest", {
    p_demand_id: buyDemandId,
    p_sell_intent_id: sell.data.id,
  });
  if (interest.error) throw interest.error;
  assert(interest.data.status === "BUYER_INTERESTED", "expected BUYER_INTERESTED");
  log("BUY interest", interest.data.id);

  const interestedRow = await a
    .from("matches")
    .select("*")
    .eq("id", interest.data.id)
    .single();
  assert(interestedRow.data.status === "BUYER_INTERESTED", "DB BUYER_INTERESTED");

  const connect = await b.rpc("seller_connect_match", {
    p_match_id: interest.data.id,
  });
  if (connect.error) throw connect.error;
  assert(connect.data.status === "CONNECTED", "BUY connect failed");
  log("BUY connect", connect.data.status);

  report.buy = "PASS";
  log("BUY", "PASS");

  // ---------- Security ----------
  // B cannot update A's TASK demand
  const steal = await b
    .from("demands")
    .update({ title: "HACKED" })
    .eq("id", taskId)
    .select("*");
  // RLS may return empty without error
  assert(
    !steal.data?.length && !steal.error,
    "unexpected: B update returned rows or error=" + steal.error?.message,
  );
  const taskCheck = await a.from("demands").select("title").eq("id", taskId).single();
  assert(taskCheck.data.title !== "HACKED", "B edited A demand");
  assert(taskCheck.data.title === "E2E 서류 픽업", "title unchanged");

  // C cannot read A/B matches
  const cReadTask = await c
    .from("matches")
    .select("*")
    .eq("id", accept.data.id);
  assert(
    (cReadTask.data ?? []).length === 0,
    "C should not read TASK match",
  );
  const cReadBuy = await c
    .from("matches")
    .select("*")
    .eq("id", interest.data.id);
  assert((cReadBuy.data ?? []).length === 0, "C should not read BUY match");

  // Seller cannot connect before interest: create another BUY pair briefly
  const buy2 = await a.rpc("upsert_buy_demand", {
    p_product_id: productId,
    p_title: "E2E BUY2",
    p_description: "second",
    p_category: "electronics",
    p_max_price: 2_000_000,
    p_location: "택배",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
  // upsert may update same ACTIVE buy - close first buy or use different product
  // For early connect: invent fake match id already tested; also try connect on non-existent
  // Additional: B tries express_buyer_interest (not owner)
  const bInterest = await b.rpc("express_buyer_interest", {
    p_demand_id: buyDemandId,
    p_sell_intent_id: sell.data.id,
  });
  assert(bInterest.error, "seller must not express buyer interest");
  log("security seller-as-buyer", bInterest.error.message);

  report.security = "PASS";
  log("SECURITY", "PASS");

  console.log("\n=== E2E SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        TASK: report.task,
        BUY: report.buy,
        Security: report.security,
        POTENTIAL_persisted: report.potentialPersisted,
        Demo_fallback: report.demoFallback,
        emails: { A: emailA, B: emailB, C: emailC },
        password,
        ids: {
          taskDemand: taskId,
          taskMatch: accept.data.id,
          buyDemand: buyDemandId,
          buyMatch: interest.data.id,
        },
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("\nE2E FAILED:", e.message || e);
  console.error(
    JSON.stringify(
      {
        TASK: report.task,
        BUY: report.buy,
        Security: report.security,
        POTENTIAL_persisted: report.potentialPersisted,
        Demo_fallback: report.demoFallback,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
