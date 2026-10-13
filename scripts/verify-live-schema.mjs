/**
 * Pre/post verification for live DAN schema (wmznpuhqmmqunwtewntt).
 * Uses anon + authenticated signup only — no service role.
 *
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
 *   node scripts/verify-live-schema.mjs [--expect-market]
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const expectMarket = process.argv.includes("--expect-market");

if (!url || !key) {
  console.error("FAIL: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}
if (!url.includes("wmznpuhqmmqunwtewntt")) {
  console.error("FAIL: verify-live-schema only targets live DAN wmznpuhqmmqunwtewntt");
  process.exit(1);
}
if (/hcbooyexjgsjzjncpvtk/i.test(url)) {
  console.error("FAIL: retired Supabase ref");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `schema.verify.${Date.now()}@dan-e2e.invalid`;
const { data: signed, error: signErr } = await sb.auth.signUp({
  email,
  password: "DanSchemaVerify-Pass1!",
  options: { data: { display_name: "Schema Verify" } },
});
if (signErr) throw signErr;
await sb.auth.setSession(signed.session);

const report = {
  project: "wmznpuhqmmqunwtewntt",
  email,
  expectMarket,
  checks: {},
};

async function mark(name, ok, detail = null) {
  report.checks[name] = ok ? { ok: true, detail } : { ok: false, detail };
}

const auth = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
}).then((r) => r.json());
mark("auth.google", auth.external?.google === true, auth.external?.google);
mark("auth.email", auth.external?.email === true, auth.external?.email);
mark("auth.apple", auth.external?.apple === true, auth.external?.apple);

const consent = await sb.rpc("get_consent_requirements");
mark("rpc.get_consent_requirements", !consent.error, consent.error?.message);
const accept = await sb.rpc("accept_my_consents");
mark("rpc.accept_my_consents", !accept.error, accept.error?.message);

const mpa = await sb.rpc("marketplace_product_allowed", { p_name: "camera" });
mark("rpc.marketplace_product_allowed", !mpa.error, mpa.error?.message ?? mpa.data);

const own = await sb.rpc("ensure_ownership", {
  p_product_id: "00000000-0000-0000-0000-000000000001",
  p_condition: "like_new",
});
mark(
  "rpc.ensure_ownership",
  !own.error || /product not found/i.test(own.error.message),
  own.error?.message,
);

const nearby = await sb.rpc("search_nearby_demands", {
  p_lat: 37.5665,
  p_lng: 126.978,
  p_radius_m: 3000,
  p_limit: 10,
});
mark("rpc.search_nearby_demands", !nearby.error, nearby.error?.message);

const marketRpc = await sb.rpc("search_nearby_demands_market", {
  p_lat: 37.5665,
  p_lng: 126.978,
  p_radius_m: 3000,
  p_limit: 10,
  p_country_code: "KR",
});
mark("rpc.search_nearby_demands_market", !marketRpc.error, marketRpc.error?.message);

const pilot = await sb.rpc("list_pilot_regions", { p_country: "JP" });
mark("rpc.list_pilot_regions", !pilot.error, pilot.error?.message);

const cols = await sb.from("demands").select("id,country_code,currency_code").limit(1);
mark("demands.market_columns", !cols.error, cols.error?.message);

const profile = await sb
  .from("profiles")
  .select("id,display_name")
  .eq("id", signed.user.id)
  .maybeSingle();
mark(
  "profile.handle_new_user",
  profile.data?.display_name === "Schema Verify",
  profile.data?.display_name ?? profile.error?.message,
);

const requiredNow = [
  "auth.google",
  "auth.email",
  "rpc.get_consent_requirements",
  "rpc.accept_my_consents",
  "rpc.marketplace_product_allowed",
  "rpc.ensure_ownership",
  "profile.handle_new_user",
];
const requiredAfterMarket = [
  ...requiredNow,
  "rpc.search_nearby_demands",
  "rpc.search_nearby_demands_market",
  "rpc.list_pilot_regions",
  "demands.market_columns",
];

const need = expectMarket ? requiredAfterMarket : requiredNow;
const failed = need.filter((k) => !report.checks[k]?.ok);
const marketGaps = [
  "rpc.search_nearby_demands",
  "rpc.search_nearby_demands_market",
  "rpc.list_pilot_regions",
  "demands.market_columns",
].filter((k) => !report.checks[k]?.ok);

report.summary = {
  failedRequired: failed,
  marketGaps,
  appleProvider: report.checks["auth.apple"],
};

console.log(JSON.stringify(report, null, 2));
if (failed.length) process.exit(expectMarket ? 1 : marketGaps.length === failed.length ? 0 : 1);
if (expectMarket && marketGaps.length) process.exit(1);
