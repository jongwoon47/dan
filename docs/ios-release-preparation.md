# DAN iOS release preparation

DAN now has separate staging and production backends and separate native auth schemes.

## Environments

- Staging Supabase: `wmznpuhqmmqunwtewntt` — preserved but currently paused to stay within the Free-plan two-active-project limit.
- Production Supabase: `hcbooyexjgsjzjncpvtk` — active in Seoul (`ap-northeast-2`).
- Staging native callback: `dan-staging://auth/callback`.
- Production native callback: `dan://auth/callback`.
- Staging bundle ID remains `app.dan.staging`.
- Production bundle ID is deliberately not guessed or committed. `DAN_IOS_BUNDLE_ID` must be the identifier actually registered in Apple Developer.

## Production backend status

- All repository migrations through account deletion are applied to production.
- Public tables have RLS enabled.
- Production starts clean: no user or transaction rows; only catalog/policy seed rows exist.
- `delete-account` Edge Function is deployed with JWT verification enabled.
- Production frontend uses only the project's publishable browser key. Service-role/secret keys must never be bundled.
- Google/Kakao/Apple provider configuration and Auth Site URL/redirect allowlist still have to be configured in the production Supabase Auth dashboard.

## Build locally on a Mac

1. Install Node 22+, Xcode 26+ and run `npm ci`.
2. Put the production public Supabase URL and publishable key in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Set `DAN_IOS_BUNDLE_ID` to the registered production bundle ID.
4. Check out `main` and run `npm run ios:production`.
5. The preparation command refuses staging URLs/refs, secret/service-role keys, non-main branches, and missing bundle IDs.
6. Open `ios/App/App.xcodeproj`, select the actual Apple Developer team, then archive/sign with the matching registered App ID.

For staging, use `npm run ios:staging`; the preparation step restores the staging bundle ID, display name, and `dan-staging` URL scheme.

## GitHub production candidate

`.github/workflows/ios-production-build.yml` builds an unsigned production simulator app and device archive from `main`. It requires:

- confirmation text `deploy-production`
- the registered production bundle ID

The workflow verifies that the bundle metadata and `dan://auth/callback` scheme were written before compiling.

## Gates before App Store submission

- Configure production Supabase Auth Site URL and redirect allowlist for the public web URL and `dan://auth/callback`.
- Configure and test any social providers that will be offered. If third-party login is offered in the iOS app, configure the required equivalent Apple login path before review.
- Register the final bundle ID/App ID and signing capability in Apple Developer.
- Validate cold/warm OAuth return, cancellation, app switching, session reload, logout, account deletion, safe areas, keyboard and transaction/chat flows on a real iPhone.
- Supply truthful privacy/support/contact URLs, privacy nutrition labels, age/content rating, screenshots and review credentials.
- Run a signed TestFlight build before public submission.

In-app account deletion is implemented in the current release candidate; active transaction checks and the deployed delete-account function remain part of the release gate.
