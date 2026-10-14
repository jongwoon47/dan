/**
 * Remote DAN staging BUY smoke E2E.
 * Uses only browser-safe Supabase credentials and pre-verified staging users.
 * It intentionally stops before trusted provider payment settlement.
 */
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const buyerEmail = process.env.DAN_E2E_BUYER_EMAIL;
const buyerPassword = process.env.DAN_E2E_BUYER_PASSWORD;
const sellerEmail = process.env.DAN_E2E_SELLER_EMAIL;
const sellerPassword = process.env.DAN_E2E_SELLER_PASSWORD;

if (!url || !key || !buyerEmail || !buyerPassword || !sellerEmail || !sellerPassword) {
  console.error("BLOCKED: missing remote staging E2E configuration");
  process.exit(2);
}

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function signin(sb, email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  assert(data.session?.user, `no session for ${email}`);
  return data.session.user;
}
async function rpc(sb, name, args) {
  const { data, error } = await sb.rpc(name, args);
  if (error) throw error;
  return data;
}

const report = {
  auth: "FAIL",
  verification: "FAIL",
  demand: "FAIL",
  quickOfferWithoutPhoto: "FAIL",
  interest: "FAIL",
  connectBeforeEvidence: "FAIL",
  chat: "FAIL",
  privateEvidence: "FAIL",
  snapshotLock: "FAIL",
  paymentGate: "FAIL",
  cancelAndReopen: "FAIL",
};

try {
  const buyer = client();
  const seller = client();
  const buyerUser = await signin(buyer, buyerEmail, buyerPassword);
  const sellerUser = await signin(seller, sellerEmail, sellerPassword);
  assert(buyerUser.id !== sellerUser.id, "buyer and seller must differ");
  report.auth = "PASS";

  // Clear only the pair's own test block state, if a prior security run left one.
  await buyer.rpc("unblock_user", { p_blocked_id: sellerUser.id });
  await seller.rpc("unblock_user", { p_blocked_id: buyerUser.id });

  const buyerVerification = await rpc(buyer, "get_my_verification", {});
  const sellerVerification = await rpc(seller, "get_my_verification", {});
  assert(buyerVerification.phoneVerified === true, "buyer phone verification missing");
  assert(
    sellerVerification.phoneVerified === true &&
      sellerVerification.identityVerified === true &&
      sellerVerification.payoutVerified === true &&
      Boolean(sellerVerification.sellerType),
    "seller connect verification missing",
  );
  report.verification = "PASS";

  const { data: products, error: productError } = await buyer
    .from("products")
    .select("id,canonical_name")
    .eq("canonical_name", "Fujifilm X100VI")
    .limit(1);
  if (productError) throw productError;
  const product = products?.[0];
  assert(product?.id, "Fujifilm X100VI seed product missing");

  const tag = Date.now();
  const demand = await rpc(buyer, "upsert_buy_demand", {
    p_product_id: product.id,
    p_title: `REMOTE STAGING BUY ${tag}`,
    p_description: "remote staging smoke",
    p_category: "camera",
    p_max_price: 1_500_000,
    p_location: "택배",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
  assert(demand.status === "ACTIVE", "BUY demand not active");
  report.demand = "PASS";

  const ownership = await rpc(seller, "ensure_ownership", {
    p_product_id: product.id,
    p_condition: "like_new",
  });

  const offer = await rpc(seller, "upsert_quick_offer", {
    p_ownership_id: ownership.id,
    p_minimum_price: 1_200_000,
    p_target_demand_id: demand.id,
    p_trade_method: "shipping",
    p_approx_usage_count: 1217,
    p_condition_note: "원격 staging E2E",
    p_quick_photo_url: null,
  });
  assert(offer.status === "OPEN", "Quick Offer not open");
  assert(offer.quick_photo_url == null, "Quick Offer photo should be optional");
  report.quickOfferWithoutPhoto = "PASS";

  const interested = await rpc(buyer, "express_buyer_interest", {
    p_demand_id: demand.id,
    p_sell_intent_id: offer.id,
  });
  assert(interested.status === "BUYER_INTERESTED", "buyer interest failed");
  report.interest = "PASS";

  const connected = await rpc(seller, "seller_connect_match", {
    p_match_id: interested.id,
  });
  assert(connected.status === "CONNECTED", "seller connect failed");
  assert(connected.deal_stage === "EVIDENCE_PENDING", "connect must precede evidence");
  report.connectBeforeEvidence = "PASS";

  await rpc(buyer, "send_message", {
    p_match_id: connected.id,
    p_body: "원격 staging 구매자 메시지",
  });
  await rpc(seller, "send_message", {
    p_match_id: connected.id,
    p_body: "원격 staging 판매자 메시지",
  });
  const { data: messages, error: messagesError } = await buyer
    .from("messages")
    .select("id")
    .eq("match_id", connected.id);
  if (messagesError) throw messagesError;
  assert((messages ?? []).length >= 2, "two-way chat missing");
  report.chat = "PASS";

  const challenge = await rpc(seller, "issue_deal_evidence_challenge", {
    p_match_id: connected.id,
  });
  assert(challenge.challenge_code, "evidence challenge missing");

  const path = `${sellerUser.id}/deal-evidence/${connected.id}-${tag}.png`;
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    "base64",
  );
  const { error: uploadError } = await seller.storage
    .from("dan-v1-evidence")
    .upload(path, tinyPng, { contentType: "image/png", upsert: false });
  if (uploadError) throw uploadError;

  const evidence = await rpc(seller, "upsert_deal_evidence", {
    p_match_id: connected.id,
    p_payload: {
      possessionPhotoUrl: `storage://dan-v1-evidence/${path}`,
      challengeCode: challenge.challenge_code,
      serialLast4: "3812",
      usageCount: 1217,
      purchaseDate: "2026-01-15",
      warrantyUntil: "2027-01-15",
      components: ["본체", "배터리", "스트랩"],
      cosmeticNotes: "원격 staging 테스트",
      knownIssues: "없음",
      repairHistory: "없음",
      waterDamageStatement: "없음",
      evidenceMeta: { source: "remote_staging_smoke" },
    },
  });
  assert(evidence.match_id === connected.id, "evidence match mismatch");
  report.privateEvidence = "PASS";

  const buyerSnapshot = await rpc(buyer, "confirm_deal_snapshot", {
    p_match_id: connected.id,
    p_agreed_price: 1_200_000,
    p_snapshot: { source: "remote_staging_smoke" },
  });
  assert(buyerSnapshot.buyer_confirmed_at, "buyer snapshot confirmation missing");

  const sellerSnapshot = await rpc(seller, "confirm_deal_snapshot", {
    p_match_id: connected.id,
    p_agreed_price: 1_200_000,
    p_snapshot: { source: "remote_staging_smoke" },
  });
  assert(sellerSnapshot.locked_at, "snapshot not locked");

  const { data: paymentState, error: paymentError } = await buyer
    .from("matches")
    .select("deal_stage,payment_status,payment_due_at")
    .eq("id", connected.id)
    .single();
  if (paymentError) throw paymentError;
  assert(paymentState.deal_stage === "PAYMENT_PENDING", "deal not payment pending");
  assert(paymentState.payment_status === "PENDING", "payment status not pending");
  assert(paymentState.payment_due_at, "payment due time missing");
  report.snapshotLock = "PASS";

  const earlyCompletion = await buyer.rpc("confirm_match_completion", {
    p_match_id: connected.id,
  });
  assert(earlyCompletion.error, "completion must be blocked before trusted payment");
  report.paymentGate = "PASS";

  const cancelled = await rpc(buyer, "cancel_deal", {
    p_match_id: connected.id,
    p_reason: "BUYER_CHANGED_MIND",
  });
  assert(cancelled.status === "CLOSED", "cancelled match not closed");
  assert(cancelled.deal_stage === "CANCELLED", "cancelled stage missing");

  const closedMessage = await seller.rpc("send_message", {
    p_match_id: connected.id,
    p_body: "닫힌 거래에서는 실패해야 함",
  });
  assert(closedMessage.error, "closed trade accepted a message");

  const reopened = await rpc(buyer, "reopen_demand_after_trade_close", {
    p_match_id: connected.id,
  });
  assert(reopened.status === "ACTIVE", "cancelled demand did not reopen");
  report.cancelAndReopen = "PASS";

  console.log(JSON.stringify(report, null, 2));
  const failed = Object.entries(report).filter(([, value]) => value !== "PASS");
  if (failed.length) {
    throw new Error(`remote staging smoke failed: ${failed.map(([key]) => key).join(", ")}`);
  }
} catch (error) {
  console.error("REMOTE STAGING E2E FAILED:", error?.message || error);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
