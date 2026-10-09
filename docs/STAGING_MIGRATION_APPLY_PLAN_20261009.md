# Staging DB migration apply plan (read-only prep)

**Date:** 2026-10-09  
**Repo HEAD baseline:** `d6f3670` (full CI green) + follow-on commercial-gates commits  
**Staging project ref (docs):** `wmznpuhqmmqunwtewntt`  
**Agent status:** Live staging ledger **BLOCKED** — this environment has no `STAGING_SUPABASE_DB_URL` / service credentials. Plan below is for owner read-only inspection, then **separate approval** before any apply.

## 1. What CI already proved (ephemeral local DB)

On `d6f3670` ([run 37933373815](https://github.com/jongwoon47/dan/actions/runs/37933373815)):

- `supabase db reset` — full migration chain including consent rename `20261008000000` + nearby `20261009000000`
- `supabase test db` (pgTAP)
- local two-user API E2E (BUY full + BORROW/TASK/SERVICE complete)
- browser smoke (consent + 4-type create + non-BUY UI complete)

This does **not** prove staging’s `schema_migrations` ledger matches the repo.

## 2. Ordered migration tail (market / privacy / consent)

Apply only versions **missing** from staging ledger, in filename order:

| Version | File | Purpose |
|---|---|---|
| … | `0001`–`0045` + dated pre-Oct 6 | Base product (assume largely present on staging) |
| `20261004065143` | anonymous discovery RLS | Anon boundary |
| `20261005190000` | complete all request types | Non-BUY mutual complete |
| `20261005201000` | match party demand visibility | Match visibility |
| `20261006054157` | account deletion | Deletion |
| `20261007000000` | user consents | Consent table |
| `20261008000000` | consent server authority | Server-owned consent versions (**renamed**; was colliding as `20261009000000`) |
| `20261009000000` | private nearby discovery | Privacy nearby RPC |
| `20261009010000` | market country/currency | `country_code` / `currency_code` |
| `20261009120000` | market partition hardening | JP write/trade blocks |

See also `docs/MIGRATION_20261009_CONSENT_RENAME.md`.

## 3. Read-only inspection SQL (owner / Dashboard)

Run in Supabase SQL Editor on **staging only** (not production):

```sql
-- A. Ledger tip
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 40;

-- B. Detect consent/nearby rename ambiguity
select version, name
from supabase_migrations.schema_migrations
where version in ('20261008000000', '20261009000000', '20261009010000', '20261009120000')
order by version;

-- C. Market columns present?
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'demands'
  and column_name in ('country_code', 'currency_code');

-- D. Nearby market RPC exists?
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('search_nearby_demands_market', 'search_nearby_demands');

-- E. JP write gate present?
select tgname from pg_trigger
where tgname ilike '%market%' or tgname ilike '%demand%write%';
```

### Interpretation matrix

| Ledger findings | Plan |
|---|---|
| None of `20261008*` / `20261009*` | Forward-apply `20261008000000` → `…09120000` in order after approval |
| Has `20261009000000` named **consent** only; nearby missing | Do **not** rename in place. Add forward migration for nearby under a **new** version; document ledger |
| Has `20261009000000` named **private_nearby**; consent authority missing | Forward-apply consent under `20261008000000` **only if** that version is absent; else new version |
| Has both under correct names matching repo | No DDL; verify RPC/grants with security probes |
| Duplicate / partial failed apply | Stop; owner reconciles ledger before any write |

## 4. Apply procedure (AFTER explicit approval)

1. Snapshot / backup staging (dashboard).
2. Confirm `DAN_ENV=staging`, confirm phrase, ref `wmznpuhqmmqunwtewntt` per `docs/STAGING.md` / `remoteDbTargetGuard`.
3. Apply **only missing** SQL files via Dashboard SQL Editor (preferred if pooler unreachable) or guarded `scripts/apply-migrations-remote.mjs` variant that lists pending files — **do not** use production refs.
4. Re-run read-only SQL §3.
5. Run `npm run test:e2e:security` and staging browser smoke against staging URL with staging anon key.
6. Do **not** enable `dan.allow_jp_market_write` / JP create unlock in the same change set.

## 5. Explicit non-goals (need separate approval)

- Production DB apply
- `main` merge / production Cloudflare deploy
- App Store / TestFlight upload
- Japan region / storefront activation
- Flipping JP market write GUC / removing create gate

## 6. Agent blocker

| Item | Status |
|---|---|
| Staging URL reachable (Pages) | `https://dan-v1-staging-jongwoon.pages.dev` HTTP 200 observed |
| Staging Postgres ledger read | **BLOCKED** — no staging DB URL / management token in agent env |
| Owner action | Paste §3 results into PR #31 comment, then approve apply plan |
