# Migration rename note: consent server authority

## Problem

Two files shared version `20261009000000`:

1. `…_consent_server_authority.sql`
2. `…_private_nearby_discovery.sql`

Fresh `supabase db reset` failed with `schema_migrations_pkey` duplicate key after consent applied and private nearby tried to insert the same version.

## Fix (this branch)

Rename consent hardening to:

`20261008000000_consent_server_authority.sql`

Intended order:

1. `20261007000000_user_consents.sql`
2. `20261008000000_consent_server_authority.sql`
3. `20261009000000_private_nearby_discovery.sql`
4. `20261009010000_market_country_currency.sql`
5. `20261009120000_market_partition_hardening.sql`

## Environment compatibility

| Environment | Expected state | Action |
|---|---|---|
| Ephemeral CI / local `db reset` | No durable ledger | Rename alone is sufficient; verify with green `supabase` job |
| Staging/prod that **never** applied either `20261009000000` | Empty for these versions | Apply forward in order after approval |
| Staging/prod that applied **only** consent as `20261009000000` | Ledger has consent under that version; private nearby missing | Do **not** rename in place on that host. Need a reviewed forward migration that installs private nearby under a new version and documents the ledger |
| Staging/prod that applied private nearby as `20261009000000` | Consent server authority missing | Forward migration for consent under a new version |

**Do not** casually rewrite already-applied migration files on a live ledger. Read-only inspect `supabase_migrations.schema_migrations` on the target before any ops apply.

## Verification checklist

- [ ] CI `supabase` job: `db reset` + `test db` + local two-user E2E + browser smoke
- [ ] Staging: read-only ledger check before apply (owner approval)
- [ ] Production: separate release authorization
