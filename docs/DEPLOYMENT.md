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

## Cost assumption

Fixed server cost target: **$0 / month** on Cloudflare Pages free + Supabase free tier, within free limits. No always-on app server.
