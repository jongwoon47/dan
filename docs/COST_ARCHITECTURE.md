# DAN Cost Architecture

DAN targets a low-fixed-cost stack. **V1 backend is live in-repo** as:

```
Vite React SPA
  → Cloudflare Pages (static hosting)
    → Supabase Auth
    → Supabase Postgres + Row Level Security (RLS)
```

Client talks to Postgres through Supabase with RLS policies as the primary
authorization boundary. Prefer SQL views / RPCs over new services.

See [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md).

## Do not introduce early

These are explicitly **out of scope** until a measured need exists:

- FastAPI (or any custom API server)
- Cloud Run / always-on containers
- Redis
- Custom websocket servers
- Paid search services
- AI APIs for core marketplace flows
- Always-on workers / schedulers for matching
- Supabase Realtime (validate necessity first)
- Edge Functions (only if RLS + Postgres cannot express the rule)

## Why POTENTIAL matches are not materialized

A Demand × SellIntent Cartesian product grows with every new seeker and seller.
Persisting every compatible pair as a `POTENTIAL` row causes:

- unnecessary DB writes and storage growth
- expensive recompute jobs / workers
- stale rows when prices or expiry change

**Rule:** compatibility is a **derived query**. Persist a match (or interest)
only when a user takes an intentional action (e.g. buyer interest →
`BUYER_INTERESTED`, then seller connect → `CONNECTED`).

Demo mode follows the same rule in memory; production persists only intentional
statuses via RPCs.
