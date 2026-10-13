# DAN ops recovery for App Store resubmission — 2026-10-13

**Live Supabase (single):** `wmznpuhqmmqunwtewntt` (`dan`)  
**Retired (do not wire / do not delete):** `hcbooyexjgsjzjncpvtk`  
**PAN:** untouched  
**PR:** #38 (`cursor/apple-review-fix-801a`)

## 1. Migration plan (non-destructive)

### Pending apply order

| # | File | Effect | Data risk |
|---|------|--------|-----------|
| 1 | `20261009000000_private_nearby_discovery.sql` | `search_nearby_demands` RPC | None (CREATE OR REPLACE) |
| 2 | `20261009010000_market_country_currency.sql` | `demands.country_code/currency_code` default KR/KRW + market nearby RPC | None — defaults backfill |
| 3 | `20261009120000_market_partition_hardening.sql` | JP write gates, rate limit, search_live_demand country arg, deal_snapshots.currency | Low — UPDATE unlocked snapshots to KRW only |
| 4 | `20261009130000_jp_pilot_region_control.sql` | Pilot region catalog + `list_pilot_regions` | None |
| 5 | `20261013000000_apple_profile_display_name.sql` | `handle_new_user` prefers Apple/Google name metadata | None — existing profiles unchanged |

### Prerequisites already on live (verified)

- Consent tables + `get_consent_requirements` / `accept_my_consents`
- `marketplace_product_allowed`, `ensure_ownership`, geo distance RPCs
- ~13 readable demands (defaults will mark KR/KRW)
- Auth: email + Google on; Apple **off**

### Rollback

Forward-only. Reverting would require `DROP COLUMN` / dropping RPCs — **destructive, needs separate approval**. Do not roll back by deleting user data.

### Apply command (when token present)

```bash
DAN_ENV=staging \
DAN_REMOTE_CONFIRM=apply-staging-only \
DAN_STAGING_SUPABASE_PROJECT_REF=wmznpuhqmmqunwtewntt \
SUPABASE_ACCESS_TOKEN=sbp_… \
VITE_SUPABASE_URL=https://wmznpuhqmmqunwtewntt.supabase.co \
VITE_SUPABASE_ANON_KEY=sb_publishable_… \
node scripts/apply-pending-live-migrations.mjs
```

Plan only (no token): `node scripts/apply-pending-live-migrations.mjs --plan`  
Pre/post REST checks: `node scripts/verify-live-schema.mjs` / `--expect-market`

**Status:** Apply **BLOCKED** in this agent — `SUPABASE_ACCESS_TOKEN` not in environment. SQL is ready; no destructive SQL in the chain.

## 2. Cloudflare production deploy (`dan.pages.dev`)

| Item | Value |
|------|--------|
| Pages project | `dan` |
| Target URL | `https://dan.pages.dev` |
| Current live content | HELLO WORLD stub |
| Workflow | `.github/workflows/deploy-cloudflare.yml` |
| Gate | `github.ref == refs/heads/main` + confirm `deploy-production` |
| Env | `VITE_DAN_ENV=production`, `VITE_DATA_MODE=supabase`, `VITE_BASE=/` |
| Supabase URL | `https://wmznpuhqmmqunwtewntt.supabase.co` |
| Browser key | publishable `sb_publishable_Me62OYFMVYkBpeCDOjM7YA_SXNGTVgw` (not service role) |
| Secrets needed | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` |

Readiness: `npm run assert:production-bundle` (build + embed checks; does not publish).

**Approval requested:** merge PR #38 to `main` (or explicitly approve production workflow from this branch), then run:

`gh workflow run deploy-cloudflare.yml --ref main -f confirm=deploy-production`

## 3. Apple / Supabase Auth (manual)

### Apple Developer (click path)

1. https://developer.apple.com/account/resources/identifiers/list  
2. **Identifiers** → select production App ID (`DAN_IOS_BUNDLE_ID`)  
3. Enable **Sign In with Apple** → **Save**  
4. Regenerate/download provisioning profile so entitlement `com.apple.developer.applesignin` is active (repo: `ios/App/App/App.entitlements`)  
5. Xcode → `ios/App/App.xcodeproj` → Signing & Capabilities → confirm **Sign in with Apple**

### Supabase Dashboard (project `wmznpuhqmmqunwtewntt`)

1. **Authentication** → **Providers** → **Apple** → Enable  
2. **Client IDs**: iOS bundle ID (`DAN_IOS_BUNDLE_ID`)  
3. **Authentication** → **URL Configuration**  
   - Site URL: `https://dan.pages.dev` (after real app deploy)  
   - Redirects: `https://dan.pages.dev/login`, `dan://auth/callback`, `dan-staging://auth/callback`  
4. Confirm `GET /auth/v1/settings` → `"apple": true`

Native iOS does **not** need Services ID / `.p8` unless web Apple OAuth is also required.

## 4. Review account

- Email: `dan.app.review@example.com` (password in agent artifact / App Store Connect only)  
- Live API login + consents: verified  
- Staging Pages browser → authenticated `/my`: verified  

## 5. iOS / TestFlight device checklist (must verify on hardware)

After `DAN_IOS_BUNDLE_ID` + Apple capability + Supabase Apple + migrations + production web:

1. `npm run ios:production` (needs bundle ID + live Supabase env)  
2. Archive / upload via `ios-production-build` or local Xcode  
3. TestFlight cold install  
4. **Must confirm on iPhone/iPad:**  
   - Apple button above Google on login  
   - Apple sign-up → consent → home  
   - Apple re-login  
   - Google login  
   - Email review account  
   - New email signup  
   - Logout / delete account  
   - Core flows: request create, search, chat, map/nearby (after market migrations)

## 6. Approvals needed from owner

1. **`SUPABASE_ACCESS_TOKEN`** (or Dashboard SQL Editor apply of the 5 files above)  
2. **Production Cloudflare deploy** to replace `dan.pages.dev` HELLO WORLD (and `CLOUDFLARE_*` if missing)  
3. **Apple Developer + Supabase Apple** toggles  
4. **`DAN_IOS_BUNDLE_ID`** + signing team for archive  
5. **App Store resubmit** (explicit; not done by agent)
