# DAN Database Schema

Reproducible SQL lives in `supabase/migrations/`.

Apply in order against a Supabase project (SQL editor or CLI):

1. `0001_initial.sql` — tables, indexes, triggers, aggregate view
2. `0002_rls.sql` — RLS policies
3. `0003_match_rpcs.sql` — match / demand RPCs
4. `0004_seed_products.sql` — product catalog seed
5. `0005_grants.sql` — grants for anon/authenticated
6. `0006_fulfillment_options.sql` — `fulfillment_options` JSONB + profile `default_area_label`
7. `0007_usability_v1.sql` — chat, activity, block/report, accept auto-decline
8. `0008_prevent_duplicate_connections.sql` — unique CONNECTED + accept guard
9. `0009_security_p0_hardening.sql` — RPC-only response/demand writes, sell_intent integrity

See [MIGRATION_APPLY.md](./MIGRATION_APPLY.md) for remote verify steps.

## Tables (center = demands)

| Table | Role |
|-------|------|
| `profiles` | `id = auth.users.id`; `default_area_label` = form/filter default |
| `products` | BUY catalog / aggregate key (not camera-only; extensible category text) |
| `demands` | BUY / BORROW / TASK / SERVICE; **`fulfillment_options` JSONB is domain truth**; `location` is public summary only |
| `ownerships` | BUY supply: I own this product |
| `sell_intents` | BUY supply: open price willingness |
| `responses` | Non-BUY fulfillment intent |
| `matches` | Persisted intentional states only (never POTENTIAL) |

## Key constraints

- ACTIVE BUY uniqueness: `(user_id, product_id)` partial unique index
- One OPEN sell intent per ownership
- One OPEN response per `(demand_id, responder_id)`
- `matches` never stores `POTENTIAL`
- `matches.buyer_id <> seller_id`
- Positive budget / prices via CHECKs

## Aggregates

`buy_demand_aggregates` is a **view** (security invoker): unique seeker count, min/max/avg budget, recent activity. No materialized POTENTIAL rows.
