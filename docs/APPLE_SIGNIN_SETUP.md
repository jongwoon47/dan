# Sign in with Apple — manual setup for App Review

Code now uses **native** Sign in with Apple on iOS (`@capacitor-community/apple-sign-in` → Supabase `signInWithIdToken` with nonce). Google/Kakao keep the existing OAuth browser flow. Human steps below are still required before a build can pass Guideline 4.8 and live login.

## Apple Developer

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers** → select the **production App ID** (the real bundle ID registered for DAN, same as `DAN_IOS_BUNDLE_ID`).
2. Enable capability **Sign In with Apple** → Save.
3. Confirm the App ID’s signing profile is regenerated so `com.apple.developer.applesignin` is present (repo ships `ios/App/App/App.entitlements`).
4. Xcode: open `ios/App/App.xcodeproj` → Signing & Capabilities → **Sign in with Apple** should appear for the App target after sync.

Native iOS does **not** require a Services ID / `.p8` secret. Those are only needed if you also enable Apple **web OAuth** for the SPA.

## Supabase Auth (staging + production)

1. Authentication → Providers → **Apple** → Enable.
2. **Client IDs**: add the iOS App ID / bundle ID (e.g. production bundle ID). If web OAuth is also used, list the Services ID **first**, then the App ID.
3. Authentication → URL Configuration:
   - Site URL: production web origin (`https://dan.pages.dev` once the real app is deployed there — not the HELLO WORLD stub).
   - Redirect allowlist must include:
     - `https://<your-web-origin>/login`
     - `dan://auth/callback` (production native Google/Kakao OAuth return)
     - `dan-staging://auth/callback` (staging only)
4. Leave **email autoconfirm** on for review builds, or ensure the App Review demo account is already confirmed.
5. After enabling, `GET /auth/v1/settings` must report `"apple": true` (and `"google": true` if Google remains offered).

## Client behavior (already in repo)

- iOS login screen shows **Apple first**, then Google/Kakao when those providers are enabled (Guideline 4.8 prominence).
- Apple uses the system sheet; cancel is silent; failures show a localized retry message.
- First Apple authorization name is written to Auth metadata and `profiles.display_name` without wiping bio/area.
- Hide My Email relay addresses are accepted as normal emails.

## Verify before resubmit

- Cold install → Apple sign-up → consent → home
- Apple re-login (name may be empty the second time)
- Google login still works
- Logout / account deletion
- Review demo email/password account reaches home with seed data

## Ops recovery cross-links

- Single DB + migration apply: `docs/OPS_RECOVERY_APPSTORE_20261013.md`
- Apply pending live SQL (when `SUPABASE_ACCESS_TOKEN` is set): `npm run db:apply:pending-live`
- Confirm Auth after dashboard toggle: `curl -sS "$VITE_SUPABASE_URL/auth/v1/settings" -H "apikey: $VITE_SUPABASE_ANON_KEY" | jq .external.apple` → `true`
