/**
 * Security regression E2E against live Supabase (anon key + RLS/RPC).
 * Run: npm run test:e2e:security
 *
 * Requires migrations through 0014 applied.
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
const password = "DanE2eSec-Pass1!";

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function noRows(res) {
  return Boolean(res.error) || !(res.data ?? []).length;
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

async function insertActiveTask(sb, userId, title) {
  const { data, error } = await sb
    .from("demands")
    .insert({
      user_id: userId,
      type: "TASK",
      title,
      description: title,
      category: "errand",
      budget: 10000,
      location: "온라인",
      fulfillment_options: [{ mode: "REMOTE" }],
      status: "ACTIVE",
      task_description: title,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

const report = {
  happyTask: "FAIL",
  happyBuy: "FAIL",
  matchCompletion: "FAIL",
  matchClose: "FAIL",
  foreignDemandUpdate: "FAIL",
  directDemandDelete: "FAIL",
  directMatchWrite: "FAIL",
  forbiddenResponseWrite: "FAIL",
  blockedPair: "FAIL",
  duplicateConnected: "FAIL",
  forgedSellIntent: "FAIL",
  ownershipDirectUpdate: "FAIL",
  distanceRpcAuth: "FAIL",
  distanceRpcQuantized: "FAIL",
  migration0008: "UNKNOWN",
  migration0009: "UNKNOWN",
  migration0014: "UNKNOWN",
};

try {
  const a = client();
  const b = client();
  const c = client();
  const userA = await signup(a, `dan.sec.a.${ts}@example.com`, "Sec A");
  const userB = await signup(b, `dan.sec.b.${ts}@example.com`, "Sec B");
  const userC = await signup(c, `dan.sec.c.${ts}@example.com`, "Sec C");

  const task = await insertActiveTask(a, userA.id, "SEC E2E TASK");
  const r1 = await b.rpc("upsert_response", {
    p_demand_id: task.id,
    p_message: "제가 할게요",
    p_offered_price: 9000,
    p_availability_text: "오늘",
  });
  if (r1.error) throw r1.error;
  const r2 = await c.rpc("upsert_response", {
    p_demand_id: task.id,
    p_message: "저도요",
    p_offered_price: 9500,
    p_availability_text: "내일",
  });
  if (r2.error) throw r2.error;

  const accept = await a.rpc("accept_response", { p_response_id: r1.data.id });
  if (accept.error) throw accept.error;
  assert(accept.data.status === "CONNECTED", "TASK not CONNECTED");
  report.happyTask = "PASS";

  const secondAccept = await a.rpc("accept_response", {
    p_response_id: r2.data.id,
  });
  assert(secondAccept.error, "second accept should fail");
  report.duplicateConnected = "PASS";
  report.migration0008 = /already connected|not active|not open/i.test(
    String(secondAccept.error.message || ""),
  )
    ? "PASS"
    : "UNKNOWN";

  const steal = await b
    .from("demands")
    .update({ title: "HACKED" })
    .eq("id", task.id)
    .select("*");
  assert(noRows(steal), "foreign demand update must fail");
  report.foreignDemandUpdate = "PASS";

  const forgeStatus = await a
    .from("demands")
    .update({ status: "CLOSED" })
    .eq("id", task.id)
    .select("*");
  assert(noRows(forgeStatus), "owner must not direct-update demand status");

  // Owner must not REST-delete demand (would CASCADE responses/matches)
  const delVictim = await insertActiveTask(a, userA.id, "SEC NO DELETE");
  const delResp = await b.rpc("upsert_response", {
    p_demand_id: delVictim.id,
    p_message: "keep me",
  });
  if (delResp.error) throw delResp.error;
  const directDel = await a
    .from("demands")
    .delete()
    .eq("id", delVictim.id)
    .select("*");
  assert(noRows(directDel), "owner must not direct-delete demand");
  const stillThere = await a
    .from("demands")
    .select("id, status")
    .eq("id", delVictim.id)
    .maybeSingle();
  assert(stillThere.data?.id === delVictim.id, "demand must survive DELETE attempt");
  const respAlive = await a
    .from("responses")
    .select("id")
    .eq("id", delResp.data.id)
    .maybeSingle();
  assert(respAlive.data?.id === delResp.data.id, "response must not CASCADE-delete");
  report.directDemandDelete = "PASS";

  const matchInsert = await b
    .from("matches")
    .insert({
      demand_id: task.id,
      response_id: r2.data.id,
      buyer_id: userA.id,
      seller_id: userB.id,
      status: "CONNECTED",
    })
    .select("*");
  assert(noRows(matchInsert), "direct matches insert must fail");
  const matchUpdate = await a
    .from("matches")
    .update({ status: "CLOSED" })
    .eq("id", accept.data.id)
    .select("*");
  assert(noRows(matchUpdate), "direct matches update must fail");
  report.directMatchWrite = "PASS";

  const product = await a.from("products").select("id").limit(2);
  assert((product.data ?? []).length >= 1, "need seeded products");
  const productId = product.data[0].id;
  const otherProductId = product.data[1]?.id ?? productId;

  const buyRpc = await a.rpc("upsert_buy_demand", {
    p_product_id: productId,
    p_title: "SEC BUY FORBIDDEN RESP",
    p_description: "buy",
    p_category: "electronics",
    p_max_price: 150000,
    p_location: "택배",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
  if (buyRpc.error) throw buyRpc.error;

  const buyResp = await b
    .from("responses")
    .insert({
      demand_id: buyRpc.data.id,
      responder_id: userB.id,
      response_type: "FULFILL",
      message: "should fail on BUY",
      status: "OPEN",
    })
    .select("*");
  assert(noRows(buyResp), "direct response on BUY must fail");

  const toClose = await insertActiveTask(a, userA.id, "SEC CLOSE ME");
  const closed = await a.rpc("close_demand", { p_demand_id: toClose.id });
  if (closed.error) throw closed.error;
  const onClosed = await b
    .from("responses")
    .insert({
      demand_id: toClose.id,
      responder_id: userB.id,
      response_type: "FULFILL",
      message: "closed",
      status: "OPEN",
    })
    .select("*");
  assert(noRows(onClosed), "direct response on CLOSED must fail");

  const openTask = await insertActiveTask(a, userA.id, "SEC OPEN RESP");
  const viaRpc = await b.rpc("upsert_response", {
    p_demand_id: openTask.id,
    p_message: "via rpc",
  });
  if (viaRpc.error) throw viaRpc.error;

  const selfAccept = await b
    .from("responses")
    .update({ status: "ACCEPTED" })
    .eq("id", viaRpc.data.id)
    .select("*");
  assert(noRows(selfAccept), "responder cannot ACCEPTED via REST");

  const ownerEdit = await a
    .from("responses")
    .update({ message: "owner forged", offered_price: 1 })
    .eq("id", viaRpc.data.id)
    .select("*");
  assert(noRows(ownerEdit), "owner cannot edit response via REST");
  report.forbiddenResponseWrite = "PASS";
  report.migration0009 = "PASS";

  const block = await a.from("blocks").insert({
    blocker_id: userA.id,
    blocked_id: userB.id,
  });
  if (block.error) throw block.error;
  const blockTask = await insertActiveTask(a, userA.id, "SEC BLOCKED");
  const blockedResp = await b.rpc("upsert_response", {
    p_demand_id: blockTask.id,
    p_message: "blocked should fail",
  });
  assert(blockedResp.error, "blocked upsert_response must fail");
  const blockedMsg = await b.rpc("send_message", {
    p_match_id: accept.data.id,
    p_body: "blocked chat",
  });
  assert(blockedMsg.error, "blocked send_message must fail");
  report.blockedPair = "PASS";

  const ownA = await a
    .from("ownerships")
    .insert({
      user_id: userA.id,
      product_id: productId,
      condition: "like_new",
      status: "OWNED",
    })
    .select("*")
    .single();
  if (ownA.error) throw ownA.error;

  const forged = await b
    .from("sell_intents")
    .insert({
      ownership_id: ownA.data.id,
      user_id: userB.id,
      product_id: otherProductId,
      minimum_price: 1,
      status: "OPEN",
    })
    .select("*");
  assert(noRows(forged), "forged sell_intent must fail");
  report.forgedSellIntent = "PASS";

  // Unblock B for happy BUY (delete own block)
  await a.from("blocks").delete().eq("blocker_id", userA.id).eq("blocked_id", userB.id);

  const buyHappy = await a.rpc("upsert_buy_demand", {
    p_product_id: productId,
    p_title: "SEC HAPPY BUY",
    p_description: "buy",
    p_category: "electronics",
    p_max_price: 2_000_000,
    p_location: "택배",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
  if (buyHappy.error) throw buyHappy.error;

  const ownB = await b
    .from("ownerships")
    .insert({
      user_id: userB.id,
      product_id: productId,
      condition: "like_new",
      status: "OWNED",
    })
    .select("*")
    .single();
  if (ownB.error) throw ownB.error;
  const sellB = await b
    .from("sell_intents")
    .insert({
      ownership_id: ownB.data.id,
      user_id: userB.id,
      product_id: productId,
      minimum_price: 1_000_000,
      status: "OPEN",
    })
    .select("*")
    .single();
  if (sellB.error) throw sellB.error;
  const interest = await a.rpc("express_buyer_interest", {
    p_demand_id: buyHappy.data.id,
    p_sell_intent_id: sellB.data.id,
  });
  if (interest.error) throw interest.error;
  const connect = await b.rpc("seller_connect_match", {
    p_match_id: interest.data.id,
  });
  if (connect.error) throw connect.error;
  assert(connect.data.status === "CONNECTED", "buy connect");
  report.happyBuy = "PASS";

  const confirmA = await a.rpc("confirm_match_completion", {
    p_match_id: connect.data.id,
  });
  if (confirmA.error) throw confirmA.error;
  assert(
    confirmA.data.status === "CONNECTED",
    "one-sided confirm stays CONNECTED",
  );
  assert(confirmA.data.buyer_completed_at, "buyer_completed_at set");
  const confirmB = await b.rpc("confirm_match_completion", {
    p_match_id: connect.data.id,
  });
  if (confirmB.error) throw confirmB.error;
  assert(confirmB.data.status === "COMPLETED", "both confirms → COMPLETED");
  assert(confirmB.data.completed_at, "completed_at set");
  report.matchCompletion = "PASS";

  const closeTask = await insertActiveTask(a, userA.id, "SEC CLOSE MATCH");
  const closeResp = await b.rpc("upsert_response", {
    p_demand_id: closeTask.id,
    p_message: "close match path",
  });
  if (closeResp.error) throw closeResp.error;
  const closeAccept = await a.rpc("accept_response", {
    p_response_id: closeResp.data.id,
  });
  if (closeAccept.error) throw closeAccept.error;
  const closedMatch = await a.rpc("close_match", {
    p_match_id: closeAccept.data.id,
  });
  if (closedMatch.error) throw closedMatch.error;
  assert(closedMatch.data.status === "CLOSED", "unilateral close");
  const msgOnClosed = await b.rpc("send_message", {
    p_match_id: closeAccept.data.id,
    p_body: "should fail",
  });
  assert(msgOnClosed.error, "CLOSED match cannot send messages");
  report.matchClose = "PASS";

  // ownership: no direct UPDATE (condition forge)
  const ownUpdate = await b
    .from("ownerships")
    .update({ condition: "sealed" })
    .eq("id", ownB.data.id)
    .select("*");
  assert(noRows(ownUpdate), "owner must not direct-update ownership");
  report.ownershipDirectUpdate = "PASS";

  // Distance RPC: anon blocked; authenticated returns quantized meters
  const geoTask = await insertActiveTask(a, userA.id, "SEC GEO DIST");
  const geoUpsert = await a.rpc("upsert_demand_exact_geo", {
    p_demand_id: geoTask.id,
    p_lat: 37.5665,
    p_lng: 126.978,
  });
  if (geoUpsert.error) throw geoUpsert.error;

  const anon = client();
  const anonDist = await anon.rpc("approx_demand_distances", {
    p_lat: 37.57,
    p_lng: 126.98,
    p_demand_ids: [geoTask.id],
  });
  assert(
    anonDist.error ||
      (Array.isArray(anonDist.data) && anonDist.data.length === 0),
    "anon must not receive distance oracles",
  );
  report.distanceRpcAuth = "PASS";

  const authDist = await a.rpc("approx_demand_distances", {
    p_lat: 37.57,
    p_lng: 126.98,
    p_demand_ids: [geoTask.id],
  });
  if (authDist.error) throw authDist.error;
  const rows = authDist.data ?? [];
  assert(Array.isArray(rows) && rows.length === 1, "auth distance row expected");
  assert(Number.isFinite(rows[0].meters), "meters must be finite");
  assert(rows[0].meters % 250 === 0, "meters must be 250m-quantized");
  assert(rows[0].meters >= 250, "minimum bucket is 250m");
  report.distanceRpcQuantized = "PASS";
  report.migration0014 = "PASS";

  console.log(JSON.stringify(report, null, 2));
  const bad = Object.entries(report).filter(([k, v]) => {
    if (
      k === "migration0008" ||
      k === "migration0009" ||
      k === "migration0014"
    ) {
      return false;
    }
    return v !== "PASS";
  });
  if (bad.length) {
    console.error("SECURITY E2E FAILED keys:", bad.map(([k]) => k).join(", "));
    process.exit(1);
  }
} catch (e) {
  console.error("SECURITY E2E FAILED:", e.message || e);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
