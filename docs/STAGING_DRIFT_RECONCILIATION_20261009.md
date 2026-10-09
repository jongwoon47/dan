# Staging schema drift reconciliation (2026-10-09)

**Status:** Documentation only — **do not apply** without explicit owner approval.  
**Confirmed staging ledger tip:** `20261006054157` (account deletion).  
**Agent DB apply:** BLOCKED (no staging credentials in this environment).

## Confirmed drift matrix

| Object | Staging (confirmed) | Repo expects | Action after approval |
|---|---|---|---|
| Ledger tip | `20261006054157` | through `20261009130000` | Forward-apply missing versions only |
| `public.user_consents` + consent RPCs | **Already present** (applied out-of-band or under alternate ledger names) | `20261007000000` + `20261008000000` | Apply repo files **as-is**; they use `IF NOT EXISTS` / `CREATE OR REPLACE` — **do not duplicate consent DDL in a new migration** |
| `public.demands.country_code` / `currency_code` | **Missing** | `20261009010000` | Apply `20261009010000` |
| Nearby / market RPCs (`search_nearby_demands*`, partition hardening) | **Missing** | `20261009000000` + `20261009120000` | Apply in order |
| JP pilot region table / `list_pilot_regions` | **Missing** | `20261009130000` | Apply after market hardening |
| Consent rename collision (`20261009000000`) | Resolve via repo rename doc | See `MIGRATION_20261009_CONSENT_RENAME.md` | Ledger must record `20261008000000` (consent authority) and `20261009000000` (nearby) under those names |

## Exact apply order (AFTER approval)

Apply only versions absent from `supabase_migrations.schema_migrations`, in this order:

1. `20261007000000_user_consents.sql` — idempotent table/policies if objects already exist  
2. `20261008000000_consent_server_authority.sql` — replace functions / requirements seed  
3. `20261009000000_private_nearby_discovery.sql`  
4. `20261009010000_market_country_currency.sql`  
5. `20261009120000_market_partition_hardening.sql`  
6. `20261009130000_jp_pilot_region_control.sql`  

**Do not** invent a parallel consent migration. Prefer `IF NOT EXISTS` / `CREATE OR REPLACE` behavior already in repo files.  
**Do not** enable `dan.allow_jp_market_write` or flip `jp_market_writes_allowed()` in the same change set.

If ledger already contains a version string but objects differ, **stop** and reconcile ledger before writing.

## SQL probes (read-only, staging SQL Editor)

```sql
-- 1) Ledger tip + market/consent versions
select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 30;

select version, name
from supabase_migrations.schema_migrations
where version >= '20261007000000'
order by version;

-- 2) Consent objects (expect present despite tip 20261006054157)
select to_regclass('public.user_consents') as user_consents;
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_consent_requirements', 'accept_my_consents');

-- 3) Market columns (expect missing before apply)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'demands'
  and column_name in ('country_code', 'currency_code');

-- 4) Nearby / market RPCs (expect missing before apply)
select p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'search_nearby_demands',
    'search_nearby_demands_market',
    'list_pilot_regions'
  );

-- 5) Write gate trigger (expect missing before 20261009120000)
select tgname from pg_trigger where tgname = 'trg_demands_market_write';

-- 6) After 20261009130000 only: pilot regions browse seed (writes still off)
select country_code, region_key, enabled
from dan_private.market_pilot_regions
order by 1, 2;

select dan_private.jp_market_writes_allowed() as jp_writes_allowed; -- expect false
```

## Local verification without Docker

- Unit: `npx vitest run src/domain/routeCandidates.test.ts src/lib/pilotRegions.test.ts`  
- Typecheck: `npm run typecheck`  
- Full migration/pgTAP requires local Supabase Docker (`supabase db reset` + `supabase test db`) — **not available in this agent VM**; treat as CI/owner path.

### Optional pgTAP note (when Docker available)

```sql
-- supabase/tests/jp_pilot_regions.sql (add only when running supabase test db)
select has_function('public', 'list_pilot_regions', array['text']);
select is(dan_private.jp_market_writes_allowed(), false, 'JP writes default off');
```

## Explicit non-goals

- Staging or production apply from this agent  
- `main` merge / Ready  
- JP write unlock / storefront activation  
- Duplicating consent DDL under a new timestamp  
