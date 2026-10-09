# DAN → Cursor engineering handoff (2026-10-09)

**Status:** WORK IN PROGRESS / Not production-release approved. **Owner handoff:** Cursor Agent running against the real local repository. Work autonomously on code/tests in a safe development branch; keep release, billing, App Store, and production DB changes behind separate human authorization.

## 0. Source of truth / starting point

- Repository: [jongwoon47/dan](https://github.com/jongwoon47/dan).
- Feature branch: `feature/dan-location-jp-launch-plan-20261009`.
- **Reviewable draft PR [#31](https://github.com/jongwoon47/dan/pull/31)** targets `feature/dan-v3-real-app-ui`. This branch is the working baseline to continue from. Avoid using `main` as the base for this feature until integration and release sequencing are reviewed.
- Existing **draft [#30](https://github.com/jongwoon47/dan/pull/30)** against `main` was a CI trigger / cross-base WIP and is **NOT MERGEABLE AS A RELEASE** (large, unrelated diff).
- Last fully green pre-market expansion CI: [37883127548](https://github.com/jongwoon47/dan/actions/runs/37883127548) (verify + visual + Supabase real two-browser trade flow).
- New market feature last observed CI **failure**: [37884445040](https://github.com/jongwoon47/dan/actions/runs/37884445040). Verify/visual passed; `supabase test db` failed because the retired country-blind function still had a test expecting `authenticated` execute. The test expectation was fixed in commit `00786ed4aacc87692246ba97b967ad1244c20efd`. **Check the NEWEST head's run** before accepting this fix; never inherit green status from an earlier SHA.
- Account-deletion / user-consent migration replay issue tracked at [#32](https://github.com/jongwoon47/dan/issues/32). Dated migrations are now ordered account deletion (20261006054157) → consent (20261007000000) → private proximity (20261009000000) → market/currency (20261009010000).
- The user submitted **DAN and PAN iOS builds on 2026-10-08**. Neither submission, their store listing, nor production deployment has been modified by this feature development.

## 1. Initial local procedure

1. Open the existing local DAN repo (previously used path `C:\\dev\\dan.v1`, verify `git remote -v` / repo root; do not assume path is current).
2. `git status --short` and inspect uncommitted work. **Never discard unrelated local changes.**
3. `git fetch origin`, `git switch feature/dan-location-jp-launch-plan-20261009` (track remote if needed), `git pull --ff-only`. Confirm `git rev-parse HEAD` matches the latest remote branch, **not necessarily a SHA listed in this dated document**.
4. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
5. After checking `supabase --help`, launch isolated local Supabase and validate `supabase start`, `supabase db reset`, `supabase test db`, then local two-user E2E and `npx playwright test --config=playwright.supabase.config.ts`. Use fake *test accounts on local DB only*, not fake marketplace inventory in production.
6. `npx playwright test e2e/visual --config=playwright.visual.config.ts` with desktop/mobile viewports. Preserve screenshots/artifacts and attach evidence to PR. Inspect failing logs rather than hiding or deleting tests.
7. If there is no way to run iOS Xcode on the current Windows machine, mark native iOS device tests BLOCKED, not PASS.

## 2. Already implemented; DO NOT accidentally revert

- KO/JA pilot locale `src/i18n/locale.ts`, `src/copy/useDanCopy.ts`, category labels, iOS location permission translations, homepage, explore, create/response, chat list, login, consent and settings. **This is not full Japan localization.**
- On-demand foreground geolocation only; opt-in current location; no continuous tracking. Local-only saved *area labels*, rejecting obvious precise coordinates and address patterns.
- `src/domain/locationDiscovery.ts`: region text, online/shipping, bidirectional? **No:** route matching is strictly FROM → TO, not reverse; approx-radius search is server-based.
- `supabase/migrations/20261009000000_private_nearby_discovery.sql`: secure aggregate *grid-coarsened* (~1 km) distance; revoke arbitrary-ID 250m probe, restrict exact-coordinate SELECT from anon. No raw request coordinates in public results.
- `supabase/migrations/20261009010000_market_country_currency.sql`: `demands.country_code` defaults KR, `currency_code` defaults KRW; valid KR/KRW or JP/JPY pair constraint; privileged RPC `search_nearby_demands_market(lat,lng,radius,limit,country)` with explicit country, revoking old blind search.
- `src/data/supabase/api.ts`, `src/data/supabase/mappers.ts`, `src/domain/types.ts`: map country/currency and request country-filtered proximity. `src/lib/format.ts` formats the **stored** currency, never auto-converts KRW amounts merely because UI is Japanese.
- `src/pages/DemandFeedPage.tsx`: explicit KR/JP storefront selection independent of language; KR BUY aggregation is not shown in JP market; saved country areas; nearby 1/3/5/10 km; route from/to; optional Google/Apple Maps direction links based on **typed place names** only, with external data-sharing disclosure. These links DO NOT implement in-app mapping or real route ETA.
- `src/pages/CreateDemandPage.tsx`: `?country=JP` intentionally shows an unavailable-state screen, preventing JP users' JPY intentions from silently being inserted as KR/KRW requests. **Do not bypass this gate just to make the UI look complete.**
- `supabase/tests/market_country.sql`, `supabase/tests/location_discovery.sql`, `src/lib/marketMoney.test.ts`, `src/lib/mapLinks.test.ts`, `e2e/visual/location-japan.spec.ts` and other regression tests.
- App Store Japan metadata is a draft in `docs/DAN_JAPAN_APPSTORE_METADATA_DRAFT.md`, not an approved translation / Store listing. Earlier strategy in `docs/DAN_LOCATION_JAPAN_LAUNCH_PLAN_20261009.md` may contain now-outdated "plan only" statements; reconcile with actual code.

## 3. Execute remaining work in priority order, WITHOUT ASKING FOR EACH ORDINARY CODE CHANGE

### P0 — Hardening & zero red tests (must finish first)

- [ ] Re-run and fix the **latest** CI and local DB migrations/tAP tests, local two-account four-type trade E2E and visual tests. The prior stale expectation for country-blind RPC must remain revoked; update the test, not the production grant.
- [ ] Full security review of **both** distance functions including credential/session checks, deleted user / owner, blocked users, restricted goods, status / expiry, rate limiting, query-throttling, coordinate input validation, denied permissions, stale sessions. Since the RPC is SECURITY DEFINER, compare visible results against intended RLS policies, not just syntactic success. Investigate possible GPS probing and 1km grid-binning leakage; don't promise mathematical anonymity.
- [ ] Review additive migration idempotency and history on **real deployment target read-only first**. Never casually edit a migration already applied to an environment. Resolve inconsistent migration ledger by proposing a reviewed forward migration.
- [ ] Fix explicit country leakage end-to-end: no cross-country local results, matches, notifications, saved-area filters, BUY aggregation, shared search or card links; **even if someone changes query params**. Establish backend enforcement; UI filters alone are insufficient.
- [ ] Audit currency across cards, demand details, response offers, match/deal snapshot, chat, notifications, price sorting, validation and API: no KRW/JPY mix-ups; DB constraint alone is insufficient. Preserve legacy KRW semantics.
- [ ] Audit strict real-world create/edit/offer/accept/complete/report/block/delete flows for all four demand types, including failure/offline cases, denied location, expiry and empty states on mobile.
- [ ] Re-test registration→required consent→transaction: never bypass consent and never hardcode privileged service-role operations in app code.

### P1 — Production-grade KR behavior & location UX

- [ ] Nearby search performance: bounded + indexed or PostGIS spatial prefilter, pagination beyond first 40 results, stable ordering, no full-table scan on high data volume. Document measured results; do not invent latency.
- [ ] Correct filter precedence and reliability: area vs GPS vs online, choice of request type, filters on reload and deep links, persisted selected market, no false "no requests" during loading/error.
- [ ] Safer place selection & availability: verify the existing reverse-geocoder service usage terms and throttling, build provider adapter with official licensing/attribution, accurate admin codes and manually entered addresses; do not expose home coordinates as map pins.
- [ ] Map/list architecture if genuinely needed for product value: approximate area markers only. Never manufacture coordinates from unrelated photos/product images.
- [ ] Finish design polish with existing commercial app system: typography, 390/720/1180/1440 widths, no horizontal overflow, actual data-backed cards and comprehensive zero-state QA.

### P2 — Genuine Japan pilot, NOT superficial language toggle

- [ ] Make locale translations exhaustive for create/edit/detail/offers/chat/deals/payments/status/notifications/report/block/profile/deletion/help/error/consent; test Japanese QA on 4 types. Use native-speaker review for nuance.
- [ ] Japan identity/address support: prefecture, city, district, timezone Asia/Tokyo, postcode input and validation; country-at-request and per-fulfillment location; never infer from device language.
- [ ] Real JPY creation, API, database writing, pricing and deal lifecycle **only after** policies, product ownership, allowed payment modes, country-coded matching and conversion-safe migration are designed and tested. No currency conversion by string substitution. Retain `?country=JP` gate until those tests PASS.
- [ ] Legal / safety readiness: Japanese privacy policy, terms, prohibited categories, user content rights, APPI and platform/consumer obligations, abuse reporting, deletion, dispute response, accessible Japanese support. **Prepare drafts/issue lists but legal approvals require a human qualified reviewer.**
- [ ] Pick **one Japanese pilot geography** based on real test users / recruitment evidence, not fake listings. Keep Japan storefront availability off until approval.
- [ ] Native iOS `ja-JP` TestFlight acceptance incl location permission strings, Apple social login as applicable, consent/account deletion and 4-type transaction flows. Only a real supported Mac/iPhone environment can certify this; don't claim PASS otherwise.
- [ ] App Store metadata/screenshot draft grounded only in working product features and correctly disclosed data types. Actual App Store changes require separate owner authorization.

## 4. Non-negotiable guardrails

- **No merge into `main` or production branch, no Cloudflare/Vercel production deploy, no production/staging data mutation with live users, no store build upload, no App Store Connect action or Japan country availability flip** without a separate release authorization. Development branch commits and local ephemeral test databases are permitted.
- Do not touch PAN repo/account. Scope is DAN.
- Do not fabricate user demand, images, transactions, test coverage, logs, performance or pass reports. Seeds only in isolated local test DB.
- Never paste .env, tokens, Apple authentication/session, service-role credentials, or personal GPS into PR/issue/logs/this chat. Do not ask owner to send credentials in chat.
- Preserve existing account deletion, consent versions, service safety constraints and DB RLS; fail closed on unknown country/currency/data.
- Keep changes reviewable in small commits/sub-PRs or a draft PR based on the correct V3 feature branch; no force push or destructive reset.
- If a missing external provider, legal review, paid service, iOS Mac/device, merchant settlement or App Store action blocks completion: implement safe fallback and create a **specific BLOCKED item** with exact owner action. Never claim that a mock is real.
- For developer-only iteration, do not repeatedly ask the owner to approve obvious fixes; handle tests, logs and code changes independently.

## 5. Required final evidence format

At the end of each complete implementation segment, report:
`BRANCH`, `HEAD SHA`, `PR URL`, `diff scope`, `typecheck/lint/unit/build`, `supabase local init & pgTAP`, `2-user real browser E2E`, `visual viewports`, `iOS device`, `rollout/data migration safety`, `BLOCKERS`, `NEXT PATCH`.

**Do not use "완벽"/"출시 완료" until all requested-country live user journeys, security, performance, legal, iOS device and CI gates are genuinely complete.** Phase-by-phase PASS only. The goal is a commercial-quality DAN, but the status must be evidence-backed.
