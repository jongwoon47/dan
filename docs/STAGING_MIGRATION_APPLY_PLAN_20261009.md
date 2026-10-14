# Staging DB migration apply plan (read-only prep)

**Date:** 2026-10-09  
**Repo HEAD baseline:** commercial-complete branch (route candidates + JP pilot region control)  
**Staging project ref (docs):** `wmznpuhqmmqunwtewntt`  
**Agent status:** Live staging apply **BLOCKED** — no `STAGING_SUPABASE_DB_URL` / service credentials. Plan is for owner inspection + **separate approval** before any apply.

Detailed probes: `docs/STAGING_DRIFT_RECONCILIATION_20261009.md`.

## 1. Confirmed staging drift (2026-10-09)

| Fact | Value |
|---|---|
| Ledger tip | `20261006054157` (account deletion) |
| Consent tables / functions (`user_consents`, `get_consent_requirements`, `accept_my_consents`) | **Already exist** on staging (ahead of ledger / out-of-band) |
| Market columns (`demands.country_code`, `currency_code`) | **Do not exist** |
| Nearby / market RPCs + write-gate trigger | **Do not exist** |
| JP pilot region control (`20261009130000`) | **Not applied** |

**Implication:** Forward-apply `20261007000000` … `20261009130000` **as-is** after approval. Consent files are idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) — **do not** author a second consent DDL migration. No `20261009140000` no-op was added; reconciliation lives in the drift doc.

## 2. What CI already proved (ephemeral local DB)

On `d6f3670` ([run 37933373815](https://github.com/jongwoon47/dan/actions/runs/37933373815)):

- `supabase db reset` — full migration chain including consent rename `20261008000000` + nearby `20261009000000`
- `supabase test db` (pgTAP)
- local two-user API E2E (BUY full + BORROW/TASK/SERVICE complete)
- browser smoke (consent + 4-type create + non-BUY UI complete)

This does **not** prove staging’s `schema_migrations` ledger matches the repo. Follow-on migrations `20261009010000`–`20261009130000` also need local CI / owner apply.

## 3. Exact apply order after approval

Apply only versions **missing** from the staging ledger, in filename order:

| Order | Version | File | Purpose |
|---|---|---|---|
| (baseline tip) | `20261006054157` | account deletion | Already on staging |
| 1 | `20261007000000` | user consents | Idempotent if table already present |
| 2 | `20261008000000` | consent server authority | Replace/seed requirements + RPCs |
| 3 | `20261009000000` | private nearby discovery | Privacy nearby RPC |
| 4 | `20261009010000` | market country/currency | `country_code` / `currency_code` |
| 5 | `20261009120000` | market partition hardening | JP write/trade blocks |
| 6 | `20261009130000` | JP pilot region control | Browse-only region catalog + `list_pilot_regions` |

See also `docs/MIGRATION_20261009_CONSENT_RENAME.md`.

## 4. Read-only inspection SQL (owner / Dashboard)

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
where version in (
  '20261008000000', '20261009000000', '20261009010000',
  '20261009120000', '20261009130000'
)
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
  and p.proname in (
    'search_nearby_demands_market',
    'search_nearby_demands',
    'list_pilot_regions'
  );

-- E. JP write gate present?
select tgname from pg_trigger
where tgname ilike '%market%' or tgname ilike '%demand%write%';

-- F. Consent objects present despite tip?
select to_regclass('public.user_consents');
```

### Interpretation matrix

| Ledger / object findings | Plan |
|---|---|
| Tip `20261006054157`; consent objects exist; market/nearby missing (**confirmed**) | After approval: apply `20261007` → `20261009130000` as-is (IF NOT EXISTS); do not duplicate consent DDL |
| None of `20261008*` / `20261009*` | Same forward-apply order |
| Has `20261009000000` named **consent** only; nearby missing | Do **not** rename in place. Stop; owner reconciles ledger vs `MIGRATION_20261009_CONSENT_RENAME.md` |
| Has both under correct names matching repo | No DDL for those versions; continue only with later missing files |
| Duplicate / partial failed apply | Stop; owner reconciles ledger before any write |

## 5. Apply procedure (AFTER explicit approval)

1. Snapshot / backup staging (dashboard).
2. Confirm `DAN_ENV=staging`, confirm phrase, ref `wmznpuhqmmqunwtewntt` per `docs/STAGING.md` / `remoteDbTargetGuard`.
3. Apply **only missing** SQL files via Dashboard SQL Editor (preferred if pooler unreachable) or guarded `scripts/apply-migrations-remote.mjs` variant that lists pending files — **do not** use production refs.
4. Re-run read-only SQL §4 + probes in `STAGING_DRIFT_RECONCILIATION_20261009.md`.
5. Run `npm run test:e2e:security` and staging browser smoke against staging URL with staging anon key.
6. Do **not** enable `dan.allow_jp_market_write` / JP create unlock / treat `market_pilot_regions.enabled` as write unlock.

## 6. Explicit non-goals (need separate approval)

- Production DB apply
- `main` merge / production Cloudflare deploy
- App Store / TestFlight upload
- Japan region / storefront activation
- Flipping JP market write GUC / removing create gate
- Ready-for-merge without owner gate

## 7. Agent blocker

| Item | Status |
|---|---|
| Staging URL reachable (Pages) | `https://dan-v1-staging-jongwoon.pages.dev` HTTP 200 observed |
| Staging Postgres apply | **BLOCKED** — no staging DB URL / management token in agent env |
| Owner action | Confirm §1 matrix, approve §3 apply order, then apply |
