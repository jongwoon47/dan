#!/usr/bin/env node
/**
 * Create or reset an App Store review demo account in a target Supabase project.
 *
 * Requires service-role key in the environment (never commit it):
 *   SUPABASE_URL=https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   REVIEW_EMAIL=reviewer@example.com
 *   REVIEW_PASSWORD=...   # pass via env only
 *   REVIEW_DISPLAY_NAME=App Reviewer
 *
 * Usage:
 *   node --env-file-if-exists=.env.local scripts/seed-app-review-account.mjs
 */
import { createClient } from "@supabase/supabase-js";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(2);
  }
  return value;
}

const url = required("SUPABASE_URL");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const email = required("REVIEW_EMAIL");
const password = required("REVIEW_PASSWORD");
const displayName = process.env.REVIEW_DISPLAY_NAME?.trim() || "App Reviewer";

if (/service_role|eyJ/.test(JSON.stringify(process.argv))) {
  // Defensive: never print secrets.
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (list.error) {
  console.error("listUsers failed:", list.error.message);
  process.exit(1);
}

const existing = list.data.users.find(
  (user) => user.email?.toLowerCase() === email.toLowerCase(),
);

let userId;
if (existing) {
  const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) {
    console.error("updateUser failed:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("Updated existing review user:", userId);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("Created review user:", userId);
}

// accept_my_consents needs auth.uid(); seed consents with the service role instead.
const { data: requirements, error: reqError } = await admin
  .from("consent_requirements")
  .select("terms_version, privacy_version")
  .eq("singleton", true)
  .maybeSingle();
if (reqError) {
  console.error("consent_requirements read failed:", reqError.message);
  process.exit(1);
}
if (requirements) {
  const now = new Date().toISOString();
  const { error: upsertError } = await admin.from("user_consents").upsert(
    {
      user_id: userId,
      terms_version: requirements.terms_version,
      privacy_version: requirements.privacy_version,
      terms_accepted_at: now,
      privacy_accepted_at: now,
    },
    { onConflict: "user_id" },
  );
  if (upsertError) {
    console.error("consent upsert failed:", upsertError.message);
    process.exit(1);
  }
}

const { error: profileError } = await admin
  .from("profiles")
  .update({ display_name: displayName })
  .eq("id", userId);
if (profileError) {
  console.error("profile update failed:", profileError.message);
  process.exit(1);
}

console.log("Review account ready.");
console.log("Email:", email);
console.log("Password: [redacted — from REVIEW_PASSWORD env]");
console.log(
  "Put these credentials only in App Store Connect Review Information, not in git.",
);
