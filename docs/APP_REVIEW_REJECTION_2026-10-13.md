# App Review rejection — 2026-10-13 investigation

Version referenced: **1.0 (5)**

## Root causes (code + live environment)

### 1. Guideline 4.8 — missing equivalent privacy login

- Staging Auth settings (`wmznpuhqmmqunwtewntt`): `google: true`, **`apple: false`**, `kakao: false`.
- Previous iOS UI only rendered Apple when `settings.external.apple === true`, so reviewers saw Google without an equivalent Apple option.
- No `Sign in with Apple` entitlement was committed; OAuth-only Apple was never production-configured.

**Code fix in this branch:** native Sign in with Apple, entitlements, Apple-first button on iOS when third-party login is present.

**Still required (human):** enable Apple provider in Supabase with the production bundle ID; enable Sign in with Apple on the App ID.

### 2. Guideline 2.1 — demo account login failed

- Former production Supabase project `hcbooyexjgsjzjncpvtk.supabase.co` returns **NXDOMAIN**.
- Cloudflare production Pages `https://dan.pages.dev` currently serves a stub (`HELLO WORLD.`), not DAN.
- iOS/production workflows previously embedded the dead URL.

**Cutover (this branch):** clients retargeted to the single live project `wmznpuhqmmqunwtewntt` (see `docs/SINGLE_SUPABASE_CUTOVER_20261013.md`). Retired project is not deleted.

**Still required (human):** deploy real DAN to `dan.pages.dev`, reset/create App Review demo user with service-role (`scripts/seed-app-review-account.mjs`), seed review data. Do **not** paste the review password into git.

### 3. Guideline 2.1(a) — new registration incomplete

- Against **live staging**, email signup → profile trigger → consent RPC succeeds (verified 2026-10-13).
- Against the dead production backend, every signup fails at the network layer — this matches “cannot complete registration.”
- Consent gate after auth is intentional; reviewers must accept terms/privacy once. That path works when the backend is reachable.

## What this PR changes

- Native Apple Sign In + nonce verification via Supabase `signInWithIdToken`
- iOS entitlement `com.apple.developer.applesignin`
- Login UI / ordering for 4.8
- Profile `handle_new_user` name metadata for Apple/Google
- Setup + review notes (this doc + `APPLE_SIGNIN_SETUP.md`)

## Status

**BLOCKED** for READY declaration until production backend DNS, Pages deploy, Apple provider enablement, and a verified demo account are confirmed on a signed device build.
