# DAN Location Utility + Japan Launch — 2026-10-09

Status: PLAN ONLY; no migrations, no production deploy, no App Store Connect changes, no App Store build upload.

## Release safety
- DAN iOS build was already submitted for App Review on 2026-10-08. Do not alter that submission, the production website, `main`, production Supabase, or uploaded iOS build to execute this plan.
- Implement later in separate PRs, stage and test, then choose a subsequent iOS app version after review.
- Preserve BUY / BORROW / TASK / SERVICE, existing agreement, account-deletion, safety and transaction lifecycles, existing responsive app UI.

## Current code observations (branch feature/dan-v3-real-app-ui)
- `src/lib/geolocation.ts`: on-demand navigator.geolocation.getCurrentPosition; reverse-geocodes through public OSM Nominatim; uses an approximate public label; holds raw current coordinates in `Place.geo`.
- `src/lib/geoDistance.ts`: viewer geolocation in sessionStorage, Haversine and approximate distance labels.
- `src/domain/fulfillment.ts`: `isNearbyFulfillment` is region2/label matching, **not** numeric-radius search.
- `src/data/supabase/api.ts`: upsert exact demand coordinates through RPC and fetch approximate distances RPC.
- `supabase/migrations/0012_gps_privacy.sql`: `demand_exact_geo` with owner-only RLS; distance RPC. `docs/RLS_SECURITY.md` describes later 250m quantization and request limits; check actual migrations and live staging DB before implementation.
- `ios/App/App/Info.plist` in this branch does not include `NSLocationWhenInUseUsageDescription`; verify generated release output and `configure-ios-target` scripts, not source file alone.
- Current UI/copy primarily Korean; `toLocaleLowerCase("ko-KR")` hard-coded in search.

## Product principle
Location answers: **Can I actually complete this request, at this place, at this time?** It must not merely show km.
- HOME: saved active area (not background tracking), one-line recommended nearby relevant requests, cross-city region switch.
- EXPLORE: `List | Map` toggle, current/search/saved area, radius preset 1/3/5/10 km, four request types, online/shipping independent of radius, sort by relevant/newest/nearby, no fake results.
- REQUEST: place picker or manual searchable place; request-specific fulfillment locations, pickup/from/to for route; nearby constraints if physical; valid if permissions denied.
- DETAIL: approximate area, distance band only if supported by server and location confidence, timing, fulfillment, compensation and CTA. No exact map pins of user home or pickup address.
- MATCH: eligibility first (country/mode, time, relevant type, status, blocked pairs), rank later (distance and travel effort, time compatibility, category, freshness); explain result and do not falsely imply confirmed travel time.
- SAVED AREAS: home, work, school as optional labels, max 3 at start; a saved area is a search preference, not publicly displayed as the user's home.
- ROUTE (phase 2): user explicitly selects start/end + direction; fetch available route corridor candidates for pickup/delivery; no continuous tracking or background-location permission, do not promise exact detours without routing service.
- PUSH (phase 2): optional digest/new request notifications for opted-in saved areas, relevance dedupe, caps, and unsubscribe.

## Privacy and safety
- Permission only when tapping 'current location', not at login; request When In Use, offer manual search and saved area as equal options.
- No exact GPS coordinates or home/work address in publicly readable objects, messages to nonparticipants, analytics, crash logs, deep links or map marker outputs.
- `demand_exact_geo` is not user-readable for other owners; compute coarse distance only server-side, enforce auth, active demand and bounded IDs/rate limits, avoid query-based trilateration and enumeration.
- Maps: show approximate district/area centroids or cells with privacy-preserving aggregation, not displaced exact pins that can be averaged back into the location.
- Do not cache raw coordinates longer than needed; add UI to clear saved area and location, and honor account deletion. For precise meetup point, exchange manually after connection and explicit consent; avoid logging in chat analytics.
- Explicitly verify App Store Privacy disclosures for Precise/Coarse Location based on actual storage/transmission behavior; update privacy policies in Korean/Japanese.
- Avoid third-party public OSM Nominatim production dependencies: comply with official 1 req/sec maximum, identification and attribution. Evaluate a provider with geocoding/autocomplete coverage/licensing for Korea + Japan and server-side quotas/caching.

## Geo and ranking data contract (proposed, not migration)
- `country_code` ISO-3166-1 alpha-2 for profile search area + per-request fulfillment, **not** inferred from UI language.
- `place_type`: area/landmark/pickup/onsite/route endpoint.
- `area_label`, `region1_code` (KR administrative or Japanese prefecture code), `region2_code`, `timezone` (Asia/Seoul or Asia/Tokyo), `centroid_precision`, `geo_source` (manual/device/geocoder), `accuracy_class`.
- Store only what is required, separate private exact coordinates from public approximate display. Assess PostgreSQL PostGIS `geography` spatial index for future radius discovery; do not bolt a distance query onto client-visible exact rows.
- Separate physical local requests from REMOTE and SHIPPING; no false 'nearby' from a string substring.
- No automatic cross-border matching for local-only fulfillment.

## JP localization
- UI language: ja-JP in addition to ko-KR, device default + manual override, persisted. Translate ALL mobile/web screens and errors/empty states/system notifications/consent/account deletion/support; not just App Store metadata.
- Format in JPY (¥; no fractional yen), Japan addresses (都道府県→市区町村→町/番地), 7-digit zip (123-4567), date/time JST `Asia/Tokyo`; use locale-aware casefold and Unicode normalization in search; preserve Japanese scripts/kana.
- Japanese request type copy proposal: BUY=買いたい, BORROW=借りたい, TASK=おつかいを頼みたい, SERVICE=手伝ってほしい. Review with native users; avoid unidiomatic literal translations.
- Region: Japan is separate launch availability and seeded location taxonomy. Pilot ONE city (Fukuoka OR Kumamoto) based on where a supply-demand cohort can be recruited; no fake listings. City availability is an in-app rollout flag, not a hidden switch that falsely promises nationwide supply.
- Japanese address provider and map attribution tested before scaling. Decide what parts of user profile can be public independently of country.
- Payments/escrow/paid work, prohibited items and seller identification: launch only after legal and operational review of Japan's APPI, consumer platform and applicable second-hand/agency rules. Do not imply one blanket permit requirement for all C2C cases.

## Implementation PR sequence
1. `feat/dan-area-locale-core`: country/locale/area data model + migration under proper new sequential name; backwards compatibility; locale UI/copy plumbing; test coverage.
2. `feat/dan-location-discovery`: location picker, search radius, server-side nearby candidate query, list sorting, safe refusal/fallback, privacy; retain UI.
3. `feat/dan-approx-map`: privacy-safe area clustering and map/list toggle (not exact pins); optional after reliability benchmarks.
4. `feat/dan-japan-localization`: Japanese translation and formats, address resolution, policies and App Store metadata drafts, region rollout gating.
5. `feat/dan-route-corridor`: only after local request density + route pilot validate useful demand; no background tracking.

## Acceptance tests (must PASS before feature release)
- Geolocation permission: grant, approximate, deny, revoke, timeout, offline, unsupported; manual area never blocked.
- Country KR/JP: search area resolves consistently; administrative name collisions do not match merely by string; radius boundary in meters; local offline vs shipping/remote.
- Privacy: no raw lat/lng in public REST, RPC, map pins, logs, chat, screenshots, analytics or error reporting; owner-only exact geo RLS and bounded distance RPC; no coordinate leakage via repeated calls.
- iOS: native Info.plist contains Korean and Japanese location usage descriptions as appropriate; iPhone real device native WebView geolocation; no Always permission.
- Japan: every core flow BUY/BORROW/TASK/SERVICE → respond → chat → complete; yen/timezone/address; Unicode Japanese search; notifications; agreement/support/deletion; region feature flag.
- Compare staging DB schema and migrations before running any migration. Run CI, typecheck, lint, unit, privacy/security test, E2E 2 accounts, visual QA at 390/1440px, Japanese long strings and real phone.
- Production/Apple submission is NO-GO until manual release gate, App Store Connect privacy/localization/availability verification, no reviewer-blocking bugs, and support/abuse response operational.

## Product metrics
- Nearby eligible request impressions → detail open → contact/offer → acceptance → completed.
- Time to first qualified response; task completion rate; location-permission opt-in (do not optimize at expense of trust); zero-result rate by area/type; Japanese pilot users requesting/responding repeatedly.
- Go/no-go for route recommendations: only when a city has enough real, recent physical requests to make a route query valuable.

## Notes
This file is a design and release specification. Implementing it, publishing to Apple, changing actual storefront availability, and touching the database are separate actions.
