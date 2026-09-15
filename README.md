# DAN

Demand-first marketplace — 필요한 사람이 먼저 올리는 곳.

Types: **BUY · BORROW · TASK · SERVICE**

## Quick start (demo)

```bash
cd DAN
npm install
npm run dev
```

Without Supabase env vars the app runs in **demo mode** (localStorage).

## Supabase mode

1. Create a Supabase project
2. Apply `supabase/migrations/*.sql` in order (see [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md))
3. Copy `.env.example` → `.env.local` and set:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

4. `npm run dev` → email/password at `/login`

Force demo even with env: `VITE_DATA_MODE=demo` (alias: `VITE_DAN_DATA_MODE=demo`)

## Validation

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Docs

- [BACKEND_ARCHITECTURE.md](docs/BACKEND_ARCHITECTURE.md)
- [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- [RLS_SECURITY.md](docs/RLS_SECURITY.md)
- [FULFILLMENT_MODEL.md](docs/FULFILLMENT_MODEL.md)
- [E2E_TEST_PLAN.md](docs/E2E_TEST_PLAN.md)
- [MIGRATION_APPLY.md](docs/MIGRATION_APPLY.md)
- [DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [COST_ARCHITECTURE.md](docs/COST_ARCHITECTURE.md)
- [SCRIPTS.md](docs/SCRIPTS.md)

## Deploy

Cloudflare Pages: build `npm run build`, output `dist`. Details in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
