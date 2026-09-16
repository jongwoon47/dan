# DAN RLS Security

Frontend uses **only** the Supabase **anon** key. Never ship `service_role`.

## Public (anon or authenticated)

- Product catalog (`products`)
- ACTIVE, non-expired demands
- BUY aggregate view (via invoker RLS on underlying demands)

## Authenticated owner writes

- Own profile update
- Own demands insert (`status=ACTIVE` only); content/lifecycle via RPC
- Own ownerships insert; sell intents own rows
- Responses / matches: RPC-only writes

## Matches

- SELECT only if `buyer_id` or `seller_id` is `auth.uid()`
- No direct INSERT/UPDATE/DELETE policies for clients
- Transitions go through RPCs that re-check actor + lifecycle

## Ownership visibility for BUY candidates

Authenticated users may read ownerships that back an **OPEN** sell intent (condition checks for derived candidates). Private ownerships without open sell intent remain owner-only.

## Threats covered in V1 RPCs

| Attempt | Result |
|---------|--------|
| Seller connect without `BUYER_INTERESTED` | Rejected |
| Non-owner express buyer interest | Rejected |
| Non-party accept response | Rejected |
| Self-match | Rejected |
| Price / condition incompatible interest | Rejected |

UI button hiding is **not** the security boundary.

## P0 hardening (0009)

| Surface | Rule |
|---------|------|
| `responses` | No direct INSERT/UPDATE; `upsert_response` / `withdraw_response` / `decline_response` / `accept_response` only |
| `demands` UPDATE | No direct UPDATE; `update_demand` / `close_demand` / accept RPCs only (INSERT create still allowed, `status=ACTIVE` only) |
| `sell_intents` | Trigger + RLS: ownership must belong to `auth.uid()` and `product_id` must match |
| `activity_events` | No direct UPDATE; `mark_activity_read` RPC only |
| `matches` | Unchanged: SELECT parties; writes via RPC only |

## Final hardening (0014)

| Surface | Rule |
|---------|------|
| `demands` DELETE | No direct DELETE (would CASCADE wipe responses/matches); close via `close_demand` only |
| `ownerships` UPDATE | No direct UPDATE; insert-only via REST |
| `approx_demand_distances` | `authenticated` only (not `anon`); returns 250m-quantized meters; max 40 demand ids per call |

## Trade completion (0015)

| Surface | Rule |
|---------|------|
| Match lifecycle | `CONNECTED` → both `confirm_match_completion` → `COMPLETED`; or unilateral `close_match` → `CLOSED` |
| Writes | RPC only (`confirm_match_completion`, `close_match`); no direct match UPDATE |
| Chat | `CONNECTED`/`COMPLETED` can send; `CLOSED` read-only |
| Trust | `completedDemandCount` = `COMPLETED` matches (not MATCHED/CLOSED demands) |

Apply/verify: [MIGRATION_APPLY.md](./MIGRATION_APPLY.md).
