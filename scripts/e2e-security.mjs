/**
 * Security regression E2E against live Supabase (anon key + RLS/RPC).
 * Run: npm run test:e2e:security
 *
 * Product: live BUY demands require phone verification (0023_verification_gates).
 * Optional SUPABASE_SERVICE_ROLE_KEY enables ops_set_user_verification so the
 * BUY happy-path can run. Without it, BUY happy-path is SKIP_NO_SERVICE_ROLE
 * (not a silent PASS). The phone-gate assertion always runs.
 *
 * Product (0030/0038): ownerships + sell_intents writes use ensure_ownership /
 * upsert_quick_offer — authenticated direct INSERT was revoked. This script
 * mirrors the app; it does not re-open REST inserts.
 *
 * Requires migrations through 0014 applied for distance RPC checks.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
const mode = process.env.VITE_DATA_MODE;

if (!url || !key) {
  console.error("FAIL: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}
if (mode === "demo") {
  console.error("FAIL: VITE_DATA_MODE=demo");
  process.exit(1);
}
if (serviceKey && /sb_publishable|anon/i.test(serviceKey)) {
  console.error("FAIL: SUPABASE_SERVICE_ROLE_KEY looks like a browser key");
  process.exit(1);
}

const ts = Date.now();
const password = "DanE2eSec-Pass1!";

function client(useService = false) {
  return createClient(url, useService ? serviceKey : key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function markVerified(userId, { phone = true, identity = false, payout = false } = {}) {
  if (!serviceKey) {
    throw new Error("ops_set_user_verification requires SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = client(true);
  const { error } = await admin.rpc("ops_set_user_verification", {
    p_user_id: userId,
    p_phone_verified: phone,
    p_identity_verified: identity,
    p_payout_verified: payout,
    p_seller_type: identity || payout ? "individual" : null,
    p_provider: "e2e-security",
    p_note: "security e2e",
  });
  if (error) throw error;
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
  buyPhoneGate: "FAIL",
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

  // Product requirement: unverified users cannot create live BUY demands.
  const unverifiedBuy = await a.rpc("upsert_buy_demand", {
    p_product_id: productId,
    p_title: "SEC BUY UNVERIFIED",
    p_description: "buy",
    p_category: "electronics",
    p_max_price: 150000,
    p_location: "택배",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
  assert(unverifiedBuy.error, "unverified BUY must be rejected");
  assert(
    /phone verification required/i.test(String(unverifiedBuy.error.message || "")),
    `expected phone gate, got: ${unverifiedBuy.error.message}`,
  );
  report.buyPhoneGate = "PASS";

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

  // Product (0031): blocks are written only via block_user RPC, not direct REST.
  const block = await a.rpc("block_user", { p_blocked_id: userB.id });
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

  // Product (0038/0030): ownership + sell_intents are RPC-only for authenticated.
  const ownA = await a.rpc("ensure_ownership", {
    p_product_id: productId,
    p_condition: "like_new",
  });
  if (ownA.error) throw ownA.error;

  // Direct sell_intents INSERT is revoked; forged REST write must fail.
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
  // Cross-user quick offer on A's ownership must also fail.
  const forgedOffer = await b.rpc("upsert_quick_offer", {
    p_ownership_id: ownA.data.id,
    p_minimum_price: 1,
    p_target_demand_id: null,
    p_trade_method: "shipping",
    p_approx_usage_count: null,
    p_condition_note: "forged",
    p_quick_photo_url: null,
  });
  assert(forgedOffer.error, "cross-user upsert_quick_offer must fail");
  report.forgedSellIntent = "PASS";

  // Unblock B for later paths
  const unblock = await a.rpc("unblock_user", { p_blocked_id: userB.id });
  if (unblock.error) throw unblock.error;

  // Match close path uses TASK (no phone gate) and always runs.
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
  const demandAfterClose = await a
    .from("demands")
    .select("status")
    .eq("id", closeTask.id)
    .single();
  if (demandAfterClose.error) throw demandAfterClose.error;
  assert(
    demandAfterClose.data.status === "MATCHED",
    "close_match keeps demand MATCHED (no auto-reopen)",
  );
  const msgOnClosed = await b.rpc("send_message", {
    p_match_id: closeAccept.data.id,
    p_body: "should fail",
  });
  assert(msgOnClosed.error, "CLOSED match cannot send messages");
  const peerReopen = await b.rpc("reopen_demand_after_trade_close", {
    p_match_id: closeAccept.data.id,
  });
  assert(peerReopen.error, "non-owner cannot reopen demand");
  const ownerReopen = await a.rpc("reopen_demand_after_trade_close", {
    p_match_id: closeAccept.data.id,
  });
  if (ownerReopen.error) throw ownerReopen.error;
  assert(ownerReopen.data.status === "ACTIVE", "owner reopen → ACTIVE");
  const demandAfterReopen = await a
    .from("demands")
    .select("status")
    .eq("id", closeTask.id)
    .single();
  if (demandAfterReopen.error) throw demandAfterReopen.error;
  assert(demandAfterReopen.data.status === "ACTIVE", "demand ACTIVE after reopen");
  report.matchClose = "PASS";

  // Distance RPC: anon blocked; authenticated returns quantized meters
  const geoTask = await insertActiveTask(a, userA.id, "SEC GEO DIST");
  const geoUpsert = await a.rpc("upsert_demand_exact_geo", {
    p_demand_id: geoTask.id,
    p_lat: 37.5665,
    p_lng: 126.978,
  });
  if (geoUpsert.error) {
    // Missing 0012 GPS migration is a real schema gap — keep FAIL, don't soften.
    throw new Error(`geo upsert failed (check 0012 migration): ${geoUpsert.error.message}`);
  }

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

  if (!serviceKey) {
    report.happyBuy = "SKIP_NO_SERVICE_ROLE";
    report.matchCompletion = "SKIP_NO_SERVICE_ROLE";
    report.ownershipDirectUpdate = "SKIP_NO_SERVICE_ROLE";
    console.log(JSON.stringify(report, null, 2));
    console.error(
      "SECURITY E2E PARTIAL: BUY happy-path needs SUPABASE_SERVICE_ROLE_KEY to mark phone/identity verification (product gate). Phone gate itself PASSED.",
    );
    process.exit(2);
  }

  await markVerified(userA.id, { phone: true });
  await markVerified(userB.id, {
    phone: true,
    identity: true,
    payout: true,
  });

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

  const ownB = await b.rpc("ensure_ownership", {
    p_product_id: productId,
    p_condition: "like_new",
  });
  if (ownB.error) throw ownB.error;
  const sellB = await b.rpc("upsert_quick_offer", {
    p_ownership_id: ownB.data.id,
    p_minimum_price: 1_000_000,
    p_target_demand_id: buyHappy.data.id,
    p_trade_method: "shipping",
    p_approx_usage_count: null,
    p_condition_note: "security e2e",
    p_quick_photo_url: null,
  });
  if (sellB.error) throw sellB.error;
  assert(sellB.data.status === "OPEN", "quick offer OPEN");
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

  // ownership: no direct UPDATE (condition forge) — product boundary after 0038
  const ownUpdate = await b
    .from("ownerships")
    .update({ condition: "sealed" })
    .eq("id", ownB.data.id)
    .select("*");
  assert(noRows(ownUpdate), "owner must not direct-update ownership");
  report.ownershipDirectUpdate = "PASS";

  console.log(JSON.stringify(report, null, 2));
  const bad = Object.entries(report).filter(([k, v]) => {
    if (
      k === "migration0008" ||
      k === "migration0009" ||
      k === "migration0014"
    ) {
      return false;
    }
    return v !== "PASS" && !String(v).startsWith("SKIP_");
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
