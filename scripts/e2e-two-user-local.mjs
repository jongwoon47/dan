/**
 * Local Supabase two-user BUY E2E.
 * Exercises the real RPC/RLS lifecycle without a paid remote project.
 *
 * Required env:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceRoleKey) {
  console.error("FAIL: missing local Supabase URL/anon/service-role env");
  process.exit(1);
}

function sb(key = anonKey) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function signup(client, email, name) {
  const { data, error } = await client.auth.signUp({
    email,
    password: "DanLocalE2e-Pass1!",
    options: { data: { display_name: name } },
  });
  if (error) throw error;
  assert(data.session?.user, `no local session after signup: ${email}`);
  return data.session.user;
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

async function createBuy(client, productId, title, maxPrice) {
  return rpc(client, "upsert_buy_demand", {
    p_product_id: productId,
    p_title: title,
    p_description: title,
    p_category: "camera",
    p_max_price: maxPrice,
    p_location: "택배",
    p_condition_preference: "any",
    p_trade_method: "shipping",
    p_expires_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    p_fulfillment_options: [{ mode: "SHIPPING" }],
  });
}

async function createOffer(client, productId, demandId, minimumPrice) {
  const ownership = await rpc(client, "ensure_ownership", {
    p_product_id: productId,
    p_condition: "like_new",
  });

  const offer = await rpc(client, "upsert_quick_offer", {
    p_ownership_id: ownership.id,
    p_minimum_price: minimumPrice,
    p_target_demand_id: demandId,
    p_trade_method: "shipping",
    p_approx_usage_count: 1200,
    p_condition_note: "로컬 E2E 상태 양호",
    p_quick_photo_url: null,
  });

  assert(offer.quick_photo_url == null, "Quick Offer must allow no photo");
  return { ownership, offer };
}

const report = {
  auth: "FAIL",
  verification: "FAIL",
  demand: "FAIL",
  quickOfferWithoutPhoto: "FAIL",
  interest: "FAIL",
  connectBeforeEvidence: "FAIL",
  chat: "FAIL",
  evidence: "FAIL",
  snapshotLock: "FAIL",
  paymentGate: "FAIL",
  handoffReady: "FAIL",
  completion: "FAIL",
  trustHistory: "FAIL",
  cancelAndReopen: "FAIL",
};

try {
  const buyer = sb();
  const seller = sb();
  const admin = sb(serviceRoleKey);
  const tag = Date.now();

  const buyerUser = await signup(buyer, `dan.local.buyer.${tag}@example.com`, "Local Buyer");
  const sellerUser = await signup(seller, `dan.local.seller.${tag}@example.com`, "Local Seller");
  assert(buyerUser.id !== sellerUser.id, "buyer and seller must differ");
  report.auth = "PASS";

  await rpc(admin, "ops_set_user_verification", {
    p_user_id: buyerUser.id,
    p_phone_verified: true,
    p_identity_verified: false,
    p_payout_verified: false,
    p_legal_name: "Local Buyer",
    p_payout_account_ref: null,
    p_seller_type: null,
  });
  await rpc(admin, "ops_set_user_verification", {
    p_user_id: sellerUser.id,
    p_phone_verified: true,
    p_identity_verified: true,
    p_payout_verified: true,
    p_legal_name: "Local Seller",
    p_payout_account_ref: "local-e2e",
    p_seller_type: "INDIVIDUAL",
  });
  report.verification = "PASS";

  const { data: products, error: productsError } = await buyer
    .from("products")
    .select("id,canonical_name")
    .in("canonical_name", ["Fujifilm X100VI", "Fujifilm X100V"]);
  if (productsError) throw productsError;

  const productA = products?.find((p) => p.canonical_name === "Fujifilm X100VI");
  const productB = products?.find((p) => p.canonical_name === "Fujifilm X100V");
  assert(productA?.id && productB?.id, "seeded camera products missing");

  // Happy BUY flow.
  const demand = await createBuy(buyer, productA.id, `LOCAL E2E BUY ${tag}`, 1_500_000);
  assert(demand.status === "ACTIVE", "BUY demand not ACTIVE");
  report.demand = "PASS";

  const { offer } = await createOffer(seller, productA.id, demand.id, 1_200_000);
  assert(offer.status === "OPEN", "Quick Offer not OPEN");
  report.quickOfferWithoutPhoto = "PASS";

  const interested = await rpc(buyer, "express_buyer_interest", {
    p_demand_id: demand.id,
    p_sell_intent_id: offer.id,
  });
  assert(interested.status === "BUYER_INTERESTED", "buyer interest transition failed");
  report.interest = "PASS";

  const connected = await rpc(seller, "seller_connect_match", {
    p_match_id: interested.id,
  });
  assert(connected.status === "CONNECTED", "seller connect failed");
  assert(connected.deal_stage === "EVIDENCE_PENDING", "connect must happen before evidence");
  report.connectBeforeEvidence = "PASS";

  await rpc(buyer, "send_message", {
    p_match_id: connected.id,
    p_body: "구매자 E2E 메시지",
  });
  await rpc(seller, "send_message", {
    p_match_id: connected.id,
    p_body: "판매자 E2E 메시지",
  });
  const { data: messages, error: messagesError } = await buyer
    .from("messages")
    .select("id")
    .eq("match_id", connected.id);
  if (messagesError) throw messagesError;
  assert((messages ?? []).length === 2, "two-user chat messages missing");
  report.chat = "PASS";

  const challenge = await rpc(seller, "issue_deal_evidence_challenge", {
    p_match_id: connected.id,
  });
  assert(challenge.challenge_code, "evidence challenge missing code");

  const evidencePath = `${sellerUser.id}/deal-evidence/${connected.id}-${tag}.png`;
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
    "base64",
  );
  const { error: uploadError } = await seller.storage
    .from("dan-v1-evidence")
    .upload(evidencePath, tinyPng, {
      contentType: "image/png",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const evidence = await rpc(seller, "upsert_deal_evidence", {
    p_match_id: connected.id,
    p_payload: {
      possessionPhotoUrl: `storage://dan-v1-evidence/${evidencePath}`,
      challengeCode: challenge.challenge_code,
      serialLast4: "3812",
      usageCount: 1217,
      purchaseDate: "2026-01-15",
      warrantyUntil: "2027-01-15",
      components: ["본체", "배터리", "스트랩"],
      cosmeticNotes: "상단 미세 사용감",
      knownIssues: "없음",
      repairHistory: "없음",
      waterDamageStatement: "없음",
      evidenceMeta: { source: "local_two_user_e2e" },
    },
  });
  assert(evidence.match_id === connected.id, "evidence match mismatch");

  const { data: afterEvidence, error: afterEvidenceError } = await buyer
    .from("matches")
    .select("deal_stage")
    .eq("id", connected.id)
    .single();
  if (afterEvidenceError) throw afterEvidenceError;
  assert(afterEvidence.deal_stage === "EVIDENCE_READY", "evidence did not advance deal");
  report.evidence = "PASS";

  const buyerSnapshot = await rpc(buyer, "confirm_deal_snapshot", {
    p_match_id: connected.id,
    p_agreed_price: 1_200_000,
    p_snapshot: { source: "local_two_user_e2e" },
  });
  assert(buyerSnapshot.buyer_confirmed_at, "buyer snapshot confirmation missing");
  assert(!buyerSnapshot.seller_confirmed_at, "seller should not be pre-confirmed");

  const sellerSnapshot = await rpc(seller, "confirm_deal_snapshot", {
    p_match_id: connected.id,
    p_agreed_price: 1_200_000,
    p_snapshot: { source: "local_two_user_e2e" },
  });
  assert(sellerSnapshot.buyer_confirmed_at, "buyer confirmation lost");
  assert(sellerSnapshot.seller_confirmed_at, "seller snapshot confirmation missing");
  assert(sellerSnapshot.locked_at, "snapshot not locked");

  const { data: paymentPending, error: paymentPendingError } = await buyer
    .from("matches")
    .select("status,deal_stage,payment_status,payment_due_at")
    .eq("id", connected.id)
    .single();
  if (paymentPendingError) throw paymentPendingError;
  assert(paymentPending.status === "CONNECTED", "match should remain CONNECTED before completion");
  assert(paymentPending.deal_stage === "PAYMENT_PENDING", "locked BUY must enter payment window");
  assert(paymentPending.payment_status === "PENDING", "payment must be PENDING");
  assert(paymentPending.payment_due_at, "payment due time missing");
  report.snapshotLock = "PASS";

  const earlyComplete = await buyer.rpc("confirm_match_completion", {
    p_match_id: connected.id,
  });
  assert(earlyComplete.error, "completion must fail before provider payment");
  report.paymentGate = "PASS";

  const paid = await rpc(admin, "settlement_mark_paid", {
    p_match_id: connected.id,
    p_provider_ref: `local-e2e-${tag}`,
  });
  assert(paid.payment_status === "PAID", "trusted settlement did not mark PAID");
  assert(paid.deal_stage === "HANDOFF_READY", "paid BUY must be handoff ready");
  report.handoffReady = "PASS";

  const buyerDone = await rpc(buyer, "confirm_match_completion", {
    p_match_id: connected.id,
  });
  assert(buyerDone.status === "CONNECTED", "one-sided completion should stay CONNECTED");
  assert(buyerDone.buyer_completed_at, "buyer completion timestamp missing");

  const sellerDone = await rpc(seller, "confirm_match_completion", {
    p_match_id: connected.id,
  });
  assert(sellerDone.status === "COMPLETED", "two-sided completion failed");
  assert(sellerDone.deal_stage === "COMPLETED", "BUY deal stage not COMPLETED");
  assert(sellerDone.buyer_completed_at && sellerDone.seller_completed_at, "completion timestamps missing");

  const { data: closedDemand, error: closedDemandError } = await buyer
    .from("demands")
    .select("status")
    .eq("id", demand.id)
    .single();
  if (closedDemandError) throw closedDemandError;
  assert(closedDemand.status === "CLOSED", "completed BUY demand must close");
  report.completion = "PASS";

  const trust = await rpc(buyer, "get_public_profile_trust", {
    p_user_id: sellerUser.id,
  });
  assert(Number(trust.completedDemandCount ?? 0) >= 1, "completed trade missing from trust history");
  report.trustHistory = "PASS";

  // Cancellation + recovery flow.
  const cancelDemand = await createBuy(buyer, productB.id, `LOCAL E2E CANCEL ${tag}`, 1_100_000);
  const { offer: cancelOffer } = await createOffer(seller, productB.id, cancelDemand.id, 900_000);
  const cancelInterest = await rpc(buyer, "express_buyer_interest", {
    p_demand_id: cancelDemand.id,
    p_sell_intent_id: cancelOffer.id,
  });
  const cancelConnected = await rpc(seller, "seller_connect_match", {
    p_match_id: cancelInterest.id,
  });
  assert(cancelConnected.deal_stage === "EVIDENCE_PENDING", "cancel flow did not connect");

  const cancelled = await rpc(buyer, "cancel_deal", {
    p_match_id: cancelConnected.id,
    p_reason: "BUYER_CHANGED_MIND",
  });
  assert(cancelled.status === "CLOSED", "cancelled match not CLOSED");
  assert(cancelled.deal_stage === "CANCELLED", "cancelled deal stage missing");

  const blockedMessage = await seller.rpc("send_message", {
    p_match_id: cancelConnected.id,
    p_body: "닫힌 거래 메시지는 실패해야 함",
  });
  assert(blockedMessage.error, "closed trade must reject new messages");

  const reopened = await rpc(buyer, "reopen_demand_after_trade_close", {
    p_match_id: cancelConnected.id,
  });
  assert(reopened.status === "ACTIVE", "buyer could not reopen cancelled demand");
  report.cancelAndReopen = "PASS";

  console.log(JSON.stringify(report, null, 2));
  const failed = Object.entries(report).filter(([, value]) => value !== "PASS");
  if (failed.length) {
    throw new Error(`local two-user E2E failed: ${failed.map(([key]) => key).join(", ")}`);
  }
} catch (error) {
  console.error("LOCAL TWO-USER E2E FAILED:", error?.message || error);
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
