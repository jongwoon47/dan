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

## Staging (separate from production)

Do **not** use Deploy Cloudflare Pages or Deploy GitHub Pages for staging.
Those workflows target the public project `dan` / GitHub Pages `/dan/`.

Staging uses a separate Cloudflare project `dan-staging`, a separate Supabase
project, GitHub Environment `staging`, and `STAGING_*` secret names.
Full checklist: [STAGING.md](./STAGING.md).

`npm run db:seed:staging` writes Live Demand rows only when `DAN_SEED_TARGET=staging` and `SUPABASE_DB_URL` are set. Localhost still works without a project ref. Remote seed also needs `DAN_STAGING_CONFIRM=seed-staging-only` and `DAN_STAGING_SUPABASE_PROJECT_REF` matching the database host. It exits before any write when those are missing, when demo mode is on, when `DAN_ENV` / `NODE_ENV` is `production`, or when the URL is the known production Supabase project.

GitHub Actions secret names used by the **production** workflows (do not copy into staging):

| Name | Where | Secret? |
|------|--------|---------|
| `VITE_SUPABASE_URL` | Pages and Cloudflare build | No (public project URL) |
| `VITE_SUPABASE_ANON_KEY` | Pages and Cloudflare build | Public client key |
| `CLOUDFLARE_API_TOKEN` | Cloudflare deploy | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare deploy | Yes |

Staging GitHub secret names (Environment `staging` only):

| Name | Where | Secret? |
|------|--------|---------|
| `STAGING_VITE_SUPABASE_URL` | Deploy Cloudflare Staging build | Staging public URL |
| `STAGING_VITE_SUPABASE_ANON_KEY` | Deploy Cloudflare Staging build | Staging public client key |
| `STAGING_CLOUDFLARE_API_TOKEN` | Deploy Cloudflare Staging | Yes, staging-scoped |
| `STAGING_CLOUDFLARE_ACCOUNT_ID` | Deploy Cloudflare Staging | Yes |
| `STAGING_SUPABASE_DB_URL` | Manual seed only, not the deploy workflow | Yes |

`VITE_BASE=/dan/` is set in the GitHub Pages workflow and is not a secret. There is no payment-provider secret in this repository.

## Cost assumption

Fixed server cost target: **$0 / month** on Cloudflare Pages free + Supabase free tier, within free limits. No always-on app server.
