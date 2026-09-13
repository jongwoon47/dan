# DAN Database Schema

Reproducible SQL lives in `supabase/migrations/`.

Apply in order against a Supabase project (SQL editor or CLI):

1. `0001_initial.sql` — tables, indexes, triggers, aggregate view
2. `0002_rls.sql` — RLS policies
3. `0003_match_rpcs.sql` — match / demand RPCs
4. `0004_seed_products.sql` — product catalog seed
5. `0005_grants.sql` — grants for anon/authenticated

## Tables (center = demands)

| Table | Role |
|-------|------|
| `profiles` | `id = auth.users.id` |
| `products` | BUY catalog / aggregate key (not camera-only) |
| `demands` | BUY / BORROW / TASK / SERVICE |
| `ownerships` | BUY supply: I own this product |
| `sell_intents` | BUY supply: open price willingness |
| `responses` | Non-BUY fulfillment intent |
| `matches` | Persisted intentional states only |

## Key constraints

- ACTIVE BUY uniqueness: `(user_id, product_id)` partial unique index
- One OPEN sell intent per ownership
- One OPEN response per `(demand_id, responder_id)`
- `matches` never stores `POTENTIAL`
- `matches.buyer_id <> seller_id`
- Positive budget / prices via CHECKs

## Aggregates

`buy_demand_aggregates` is a **view** (security invoker): unique seeker count, min/max/avg budget, recent activity. No materialized POTENTIAL rows.
