# DAN single Supabase cutover — 2026-10-13

## Product decision

DAN uses **one** live Supabase project:

| Role | Value |
|------|--------|
| Live project | `wmznpuhqmmqunwtewntt` (`dan`) |
| Staging Pages | `https://dan-v1-staging-jongwoon.pages.dev` → same DB |
| Production Pages | `https://dan.pages.dev` → same DB |
| Retired project | `hcbooyexjgsjzjncpvtk` — **do not wire clients**; **do not delete** without approval |
| PAN projects | untouched |

## Code changes

- `PRODUCTION_SUPABASE_PROJECT_REFS` → `[wmznpuhqmmqunwtewntt]`
- Retired ref tracked separately and refused by deploy/seed/remote guards
- Staging may share the live Supabase ref; it still cannot target `dan.pages.dev` or retired refs
- iOS production + Cloudflare production workflows embed the live project publishable key

## Test expectation changes (not weakenings)

| Test | Old expectation | New expectation | Product basis |
|------|-----------------|-----------------|---------------|
| `productionDeployGuard` “refuses staging URL” | Same URL as staging ref → refuse | Same URL as staging ref → **allow**; retired ref → refuse | Single live DAN DB |
| Staging guards “refuses production supabase ref” | Any production-listed ref → refuse | **Retired** refs → refuse; shared live ref OK | Same decision |
| `staging-workflow` production YAML “must not contain staging ref” | Forbid shared ref string in production workflow | Require live DAN ref; forbid **retired** ref; keep Cloudflare project isolation | Same decision |
| `deploy-pages.yml` message | “production Supabase not configured” | Refuse GitHub Pages; use Cloudflare `dan` | Hosting path clarification |

Required/preferred marketplace conditions, consent versions, and Apple name handling were **not** relaxed.

## Remote schema gaps (need DB credentials)

Verified via authenticated REST against `wmznpuhqmmqunwtewntt` (2026-10-13):

| Object | Status |
|--------|--------|
| `user_consents` / `consent_requirements` | Present |
| `get_consent_requirements` / `accept_my_consents` | Present |
| Account deletion profile columns | Present |
| `ensure_ownership` / `upsert_quick_offer` | Present |
| Phone gate on live BUY (`0023`) | Present (security E2E) |
| Distance / geo RPCs (`0012`/`0014`) | Present (security E2E) |
| `demands.country_code` / market RPCs (`20261009010000`+) | **Missing** |
| Apple `handle_new_user` / `profiles.given_name` (`20261013000000`) | **Not applied** |

Apply remaining migrations with `SUPABASE_ACCESS_TOKEN` (or `SUPABASE_DB_URL`) via `scripts/apply-sql-remote.mjs`, in repo order, after backup. This agent does not have those secrets in the environment.

Recommended apply order (non-destructive, live DAN only):

1. `20261009010000_market_country_currency.sql`
2. `20261009120000_market_partition_hardening.sql`
3. `20261009130000_jp_pilot_region_control.sql`
4. `20261013000000_apple_profile_display_name.sql`

## Live security E2E (2026-10-13)

`npm run test:e2e:security` against live DAN:

- PASS without service role: Task happy-path, phone gate, blocks RPC, forged sell intent, match close/reopen, distance RPC, foreign writes denied.
- SKIP_NO_SERVICE_ROLE (explicit, exit 2 — not silent PASS): BUY happy-path / match completion / ownership direct-update forge, because `ops_set_user_verification` needs service role.
- Test updates mirror product boundaries (`block_user`, `ensure_ownership`, `upsert_quick_offer`, phone gate). Expectations were not weakened.

## App Review demo account

`dan.app.review@example.com` signs in on live DAN; profile + required consents are present. Password is agent-store only — put in App Store Connect Review Information, never git.

## Hosting

| URL | Status |
|-----|--------|
| `https://dan-v1-staging-jongwoon.pages.dev` | Live DAN web app (200) |
| `https://dan.pages.dev` | Still **HELLO WORLD** stub — needs Cloudflare production deploy (`CLOUDFLARE_API_TOKEN` / account id) |

## Auth providers (live)

`GET /auth/v1/settings`: `google: true`, `apple: false`, `email: true`. Apple enable is a dashboard step (see `APPLE_SIGNIN_SETUP.md`).

## PAN / “71·22 failures”

This repository’s current CI and local unit suite do not surface “71” and “22” failing cases tied to PAN natural-language search (person-chip masking, language level, multi-activity, required vs preferred). Those topics are **out of scope** for DAN; PAN must not be modified here. If those counts came from another agent/project, they are not part of this cutover’s failure set.
