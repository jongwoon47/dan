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

async function createResponseDemand(client, input) {
  const now = Date.now();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  assert(authData.user?.id, `${input.type} demand requires authenticated owner`);
  const base = {
    user_id: authData.user.id,
    type: input.type,
    title: input.title,
    description: input.description ?? input.title,
    category:
      input.type === "BORROW"
        ? "rental"
        : input.type === "TASK"
          ? "errand"
          : "service",
    budget: input.budget,
    location: input.location ?? "서울",
    fulfillment_options: input.fulfillmentOptions,
    status: "ACTIVE",
    expires_at: new Date(now + 7 * 86400000).toISOString(),
  };

  const details =
    input.type === "BORROW"
      ? {
          item_name: input.itemName,
          start_at: input.startAt,
          end_at: input.endAt,
        }
      : input.type === "TASK"
        ? {
            task_description: input.taskDescription,
            due_at: input.dueAt,
          }
        : {
            service_description: input.serviceDescription,
            preferred_at: input.preferredAt,
            estimated_duration_minutes: input.estimatedDurationMinutes,
          };

  const { data, error } = await client
    .from("demands")
    .insert({ ...base, ...details })
    .select("*")
    .single();
  if (error) throw error;
  assert(data.type === input.type, `${input.type} demand type mismatch`);
  assert(data.status === "ACTIVE", `${input.type} demand not ACTIVE`);
  return data;
}

async function completeResponseFlow({
  owner,
  responder,
  outsider,
  demand,
  offeredPrice,
  label,
}) {
  const response = await rpc(responder, "upsert_response", {
    p_demand_id: demand.id,
    p_message: `${label} 응답 가능합니다`,
    p_offered_price: offeredPrice,
    p_availability_text: "오늘 가능",
  });
  assert(response.status === "OPEN", `${label} response not OPEN`);

  const connected = await rpc(owner, "accept_response", {
    p_response_id: response.id,
  });
  assert(connected.status === "CONNECTED", `${label} did not CONNECT`);
  assert(connected.response_id === response.id, `${label} response link missing`);

  await rpc(owner, "send_message", {
    p_match_id: connected.id,
    p_body: `${label} 요청자 메시지`,
  });
  await rpc(responder, "send_message", {
    p_match_id: connected.id,
    p_body: `${label} 응답자 메시지`,
  });

  const { data: messages, error: messagesError } = await owner
    .from("messages")
    .select("id")
    .eq("match_id", connected.id);
  if (messagesError) throw messagesError;
  assert((messages ?? []).length === 2, `${label} chat messages missing`);

  const outsiderMessages = await outsider
    .from("messages")
    .select("id")
    .eq("match_id", connected.id);
  if (outsiderMessages.error) throw outsiderMessages.error;
  assert(
    (outsiderMessages.data ?? []).length === 0,
    `${label} outsider could read private chat`,
  );

  const ownerDone = await rpc(owner, "confirm_match_completion", {
    p_match_id: connected.id,
  });
  assert(
    ownerDone.status === "CONNECTED",
    `${label} one-sided completion should stay CONNECTED`,
  );

  const responderDone = await rpc(responder, "confirm_match_completion", {
    p_match_id: connected.id,
  });
  assert(
    responderDone.status === "COMPLETED",
    `${label} two-sided completion failed`,
  );

  const { data: closedDemand, error: closedDemandError } = await owner
    .from("demands")
    .select("status")
    .eq("id", demand.id)
    .single();
  if (closedDemandError) throw closedDemandError;
  assert(closedDemand.status === "CLOSED", `${label} completed demand must close`);

  return { response, connected, completed: responderDone };
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
  zeroData: "FAIL",
  borrowFlow: "FAIL",
  taskFlow: "FAIL",
  serviceFlow: "FAIL",
};

try {
  const buyer = sb();
  const seller = sb();
  const outsider = sb();
  const admin = sb(serviceRoleKey);
  const tag = Date.now();

  const buyerUser = await signup(buyer, `dan.local.buyer.${tag}@example.com`, "Local Buyer");
  const sellerUser = await signup(seller, `dan.local.seller.${tag}@example.com`, "Local Seller");
  const outsiderUser = await signup(outsider, `dan.local.outsider.${tag}@example.com`, "Local Outsider");
  assert(buyerUser.id !== sellerUser.id, "buyer and seller must differ");
  assert(![buyerUser.id, sellerUser.id].includes(outsiderUser.id), "outsider must differ");
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

  await rpc(admin, "ops_set_user_verification", {
    p_user_id: outsiderUser.id,
    p_phone_verified: true,
    p_identity_verified: false,
    p_payout_verified: false,
    p_legal_name: "Local Outsider",
    p_payout_account_ref: null,
    p_seller_type: null,
  });

  const [outsiderMatches, outsiderActivities, outsiderOwnDemands] = await Promise.all([
    outsider.from("matches").select("id"),
    outsider.from("activity_events").select("id"),
    outsider.from("demands").select("id").eq("user_id", outsiderUser.id),
  ]);
  if (outsiderMatches.error) throw outsiderMatches.error;
  if (outsiderActivities.error) throw outsiderActivities.error;
  if (outsiderOwnDemands.error) throw outsiderOwnDemands.error;
  assert((outsiderMatches.data ?? []).length === 0, "fresh user should have no matches");
  assert((outsiderActivities.data ?? []).length === 0, "fresh user should have no activities");
  assert((outsiderOwnDemands.data ?? []).length === 0, "fresh user should have no own demands");
  report.zeroData = "PASS";

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

  const startAt = new Date(Date.now() + 2 * 86400000).toISOString();
  const endAt = new Date(Date.now() + 3 * 86400000).toISOString();
  const borrowDemand = await createResponseDemand(buyer, {
    type: "BORROW",
    title: `LOCAL E2E BORROW ${tag}`,
    description: "주말 캠핑용 텐트 대여",
    budget: 30_000,
    location: "서울",
    fulfillmentOptions: [{ mode: "MEETUP", place: { publicLabel: "서울" } }],
    itemName: "2인용 캠핑 텐트",
    startAt,
    endAt,
  });
  await completeResponseFlow({
    owner: buyer,
    responder: seller,
    outsider,
    demand: borrowDemand,
    offeredPrice: 25_000,
    label: "BORROW",
  });
  report.borrowFlow = "PASS";

  const taskDemand = await createResponseDemand(buyer, {
    type: "TASK",
    title: `LOCAL E2E TASK ${tag}`,
    description: "서류를 대신 전달해 주세요",
    budget: 20_000,
    location: "평택역 → 고덕",
    fulfillmentOptions: [
      {
        mode: "ROUTE",
        from: { publicLabel: "평택역" },
        to: { publicLabel: "고덕" },
      },
    ],
    taskDescription: "평택역에서 서류 수령 후 고덕 전달",
    dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
  });
  await completeResponseFlow({
    owner: buyer,
    responder: seller,
    outsider,
    demand: taskDemand,
    offeredPrice: 18_000,
    label: "TASK",
  });
  report.taskFlow = "PASS";

  const serviceDemand = await createResponseDemand(buyer, {
    type: "SERVICE",
    title: `LOCAL E2E SERVICE ${tag}`,
    description: "30분 온라인 포트폴리오 피드백",
    budget: 15_000,
    location: "온라인",
    fulfillmentOptions: [{ mode: "REMOTE" }],
    serviceDescription: "포트폴리오 피드백",
    preferredAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    estimatedDurationMinutes: 30,
  });
  await completeResponseFlow({
    owner: buyer,
    responder: seller,
    outsider,
    demand: serviceDemand,
    offeredPrice: 15_000,
    label: "SERVICE",
  });
  report.serviceFlow = "PASS";

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
