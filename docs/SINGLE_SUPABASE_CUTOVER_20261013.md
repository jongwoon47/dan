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

Verified via anon/authenticated REST against `wmznpuhqmmqunwtewntt`:

| Object | Status |
|--------|--------|
| Consent RPCs / tables | Present |
| Account deletion profile columns | Present |
| `demands.country_code` / market RPCs | **Missing** |
| Apple `handle_new_user` given/family name | **Not applied** (profile still email-local) |

Apply remaining migrations with service-role/DB URL (human or CI secret), in repo order, after backup. This agent does not have `SUPABASE_DB_URL` / management token in the environment.

## PAN / “71·22 failures”

This repository’s current CI and local unit suite do not surface “71” and “22” failing cases tied to PAN natural-language search (person-chip masking, language level, multi-activity, required vs preferred). Those topics are **out of scope** for DAN; PAN must not be modified here. If those counts came from another agent/project, they are not part of this cutover’s failure set.
