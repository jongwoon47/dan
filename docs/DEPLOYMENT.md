# DAN Deployment (Cloudflare Pages + Supabase)

## Frontend — Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- SPA routing: `public/_redirects` → `/* /index.html 200`

### Environment variables (Pages project settings)

| Name | Secret? | Notes |
|------|---------|-------|
| `VITE_SUPABASE_URL` | No | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Treat as public client key | Never use service_role |
| `VITE_DATA_MODE` | No | Optional `demo` to force localStorage adapter |

Do not commit `.env` / `.env.local`.

## Supabase

1. Create project (Free tier)
2. Run SQL migrations in order (`supabase/migrations/`)
3. Auth → Email provider ON; disable confirm email for early validation if desired
4. Auth → URL configuration:
   - Site URL: Pages URL (and `http://localhost:5173` for local)
   - Redirect URLs: same origins

## Local production-mode check

```bash
cp .env.example .env.local
# fill URL + anon key
npm run build
npm run preview
```

## Staging

Use the same Cloudflare Pages build or `workflow_dispatch` on Deploy Cloudflare Pages. Put staging values in the environment secrets below. Do not reuse a production Supabase project.

`npm run db:seed:staging` writes Live Demand rows only when `DAN_SEED_TARGET=staging` and `SUPABASE_DB_URL` are set. It exits before any write when those are missing, when demo mode is on, or when `DAN_ENV` / `NODE_ENV` is `production`.

GitHub Actions secret names used by the existing workflows:

| Name | Where | Secret? |
|------|--------|---------|
| `VITE_SUPABASE_URL` | Pages and Cloudflare build | No (public project URL) |
| `VITE_SUPABASE_ANON_KEY` | Pages and Cloudflare build | Public client key |
| `CLOUDFLARE_API_TOKEN` | Cloudflare deploy | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare deploy | Yes |

`VITE_BASE=/dan/` is set in the GitHub Pages workflow and is not a secret. There is no payment-provider secret in this repository.

## Cost assumption

Fixed server cost target: **$0 / month** on Cloudflare Pages free + Supabase free tier, within free limits. No always-on app server.
