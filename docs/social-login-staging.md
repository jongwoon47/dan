# DAN social login — staging connection

The client implements Kakao and Google OAuth through Supabase. Provider availability is read from public Auth settings. Disabled/unconfigured providers show “준비 중” and cannot be clicked. The email flow remains available. This is not a claim that live OAuth has been connected.

## Connect staging only

1. Confirm the target is staging project `wmznpuhqmmqunwtewntt`. Do not reuse another service's or production credentials without confirming ownership and intended use.
2. In Supabase Auth URL Configuration, add `https://dan-v1-staging-jongwoon.pages.dev/login` to the redirect allowlist. Retain existing entries. The client returns to `/login?next=...` and then to the protected action after session restoration.
3. Kakao Developers: create/select the DAN application; enable Kakao Login; register `https://wmznpuhqmmqunwtewntt.supabase.co/auth/v1/callback` as its redirect URI. Set nickname/profile consent as required by the provider. Configure the REST API key and active client secret in the staging Supabase Kakao provider. If account email is unavailable, follow Supabase's documented allow-users-without-email setting rather than inventing email addresses.
4. Google Cloud: create/select the DAN OAuth web client and consent screen. Configure the same Supabase callback URL. Add test users while the consent screen is in testing mode. Configure client ID and secret in staging Supabase Google provider.
5. Never put provider client secrets into `VITE_*`, Git, browser storage or chat. No extra client key is required by the SPA.
6. Once enabled, test each provider with an actual account: signup/login, first profile, logout, reload session, return to a drafted request, cancel consent, provider/network failure. Existing email credentials must continue working. Browser mocks do not establish live provider PASS.

## Client behavior

- Full-page OAuth navigation; no popup dependency on mobile browsers.
- One pending login at a time, with repeat clicks locked.
- Safe same-origin return URL; no arbitrary external redirect.
- Cancellation/failure shows a Korean message and removes OAuth error details from the address bar.
- Provider credentials are retained by Supabase/provider settings, never shipped in the client.

References: [Kakao](https://supabase.com/docs/guides/auth/social-login/auth-kakao), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google).
