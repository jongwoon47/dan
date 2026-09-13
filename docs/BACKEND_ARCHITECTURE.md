# DAN Backend Architecture (V1)

DAN remains a **static SPA** with **no application server**.

```
Cloudflare Pages (Vite + React)
        ↓
Supabase Auth (email/password)
        ↓
Supabase Postgres + RLS + SQL/RPC
```

## Modes

| Mode | When | Source of truth |
|------|------|-----------------|
| `demo` | Missing env **or** `VITE_DATA_MODE=demo` (alias `VITE_DAN_DATA_MODE`) | localStorage + in-memory domain |
| `supabase` | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set | Postgres via anon key + RLS |

Tests force `demo`.

## Layers

1. **UI** (`src/pages`, `src/components`) — no direct Supabase calls
2. **Domain** (`src/domain`) — invariants, feed, derived POTENTIAL matches
3. **Data adapter** (`src/data/supabase`) — queries / RPCs
4. **Auth** (`src/auth/AuthProvider`) — session restore

## Mutations

`execute → success → refetch`. No optimistic writes. No Realtime. No Edge Functions.

Match transitions that must be atomic use **Postgres RPCs** (`security definer`):

- `express_buyer_interest`
- `seller_connect_match`
- `accept_response`
- `upsert_buy_demand`

## Out of scope (still)

Chat, push, payment, escrow, AI, Redis, custom websockets, FastAPI/Cloud Run, Realtime.

See also [COST_ARCHITECTURE.md](./COST_ARCHITECTURE.md).
