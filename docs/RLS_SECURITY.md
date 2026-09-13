# DAN RLS Security

Frontend uses **only** the Supabase **anon** key. Never ship `service_role`.

## Public (anon or authenticated)

- Product catalog (`products`)
- ACTIVE, non-expired demands
- BUY aggregate view (via invoker RLS on underlying demands)

## Authenticated owner writes

- Own profile update
- Own demands insert/update/delete
- Own ownerships / sell intents
- Own responses insert
- Response updates by responder or demand owner

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
