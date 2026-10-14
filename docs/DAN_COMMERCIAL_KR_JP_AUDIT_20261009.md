# DAN Commercialization Audit — KR four-type trade + JP/i18n gaps

**Branch:** `cursor/dan-commercial-gates-e0e7` @ `d6f3670`  
**Date:** 2026-10-09  
**Scope:** Read-only map of existing flows, CI proof vs staging gaps, and implementable JP/i18n increments that **do not** unlock JP market writes.

Related: `docs/DAN_COMMERCIALIZATION_SPEC_V1.md`, `docs/CURSOR_DAN_HANDOFF_20261009.md`, `docs/DAN_LOCATION_JAPAN_LAUNCH_PLAN_20261009.md`, `docs/E2E_TEST_PLAN.md`, `docs/BETA_E2E_CHECKLIST.md`.

---

## A. KR four-type trade + location audit

### A.1 Two-account lifecycle by type

All four types share chat / complete / cancel / report / block after connection. Creation and connect paths diverge for BUY.

| Stage | BUY | BORROW / TASK / SERVICE |
|---|---|---|
| **Create** | UI: `CreateDemandPage` / `BuyDemandCreatePage` → `store.supabase.createDemand` → `api.createDemandRemote` / `upsert_buy_demand` | UI: `CreateDemandPage` → insert via `createDemandRemote` (typed details: borrow dates, task due, service preferred+duration) |
| **Respond** | Seller: ownership → Quick Offer (`ensure_ownership`, `upsert_quick_offer`) — not `upsert_response` | Responder: `upsert_response` from demand detail (`DemandItemPage` CTA) |
| **Connect** | Buyer `express_buyer_interest` → seller `seller_connect_match` → `CONNECTED` + `EVIDENCE_PENDING` | Owner `accept_response` → match `CONNECTED` |
| **Chat** | `send_message` on match; UI `MatchChatPage` / `ConversationsPage` | Same |
| **Complete** | Evidence → snapshot lock → payment gate → handoff → bilateral `confirm_match_completion` (BUY blocked until PAID) | Bilateral `confirm_match_completion` (no payment gate); demand closes |
| **Cancel** | `cancel_deal` (structured reasons); optional `reopen_demand_after_trade_close` | Chat cancel sheet → `cancel_deal` or match close path (BUY-specific cancel RPC required for BUY) |
| **Report / block** | `submit_user_report` / `block_user` from chat overflow + profile | Same |

#### Key files (client)

| Concern | Path |
|---|---|
| Routes / shell | `src/App.tsx`, `src/components/layout/AppShell.tsx` |
| Create (4 types + JP gate) | `src/pages/CreateDemandPage.tsx` |
| BUY product path | `src/pages/BuyDemandCreatePage.tsx`, `src/pages/OwnershipPage.tsx`, `src/pages/SellIntentPage.tsx`, `src/pages/QuickOfferPage.tsx`, `src/pages/OfferDetailPage.tsx` |
| Demand detail / respond | `src/pages/DemandItemPage.tsx`, `src/pages/DemandDetailPage.tsx` (aggregates) |
| Feed / discovery | `src/pages/DemandFeedPage.tsx` |
| My trades | `src/pages/MyDanPage.tsx` |
| Chat / complete / cancel / report / block | `src/pages/MatchChatPage.tsx`, `src/pages/ConversationsPage.tsx`, `src/pages/TradeCompletePage.tsx`, `src/pages/ProfilePage.tsx` |
| BUY deal chain | `src/pages/DealEvidencePage.tsx`, `src/pages/DealSnapshotPage.tsx`, `src/pages/SafePaymentPage.tsx`, `src/pages/HandoffPage.tsx` |
| Store adapters | `src/domain/store.supabase.tsx`, `src/domain/store.tsx` (demo), `src/data/supabase/api.ts` |
| Domain types / lifecycle | `src/domain/types.ts`, `src/domain/matching.ts`, `src/domain/matchLifecycle.ts`, `src/domain/demandLifecycle.ts`, `src/domain/fulfillment.ts` |

#### Key RPCs / DB (server)

| RPC / trigger | Role |
|---|---|
| `upsert_buy_demand`, `ensure_ownership`, `upsert_quick_offer` | BUY create / offer |
| `express_buyer_interest`, `seller_connect_match` | BUY interest → connect (evidence-after-connect) |
| `upsert_response`, `accept_response` | Non-BUY respond → connect |
| `send_message` | Chat |
| `issue_deal_evidence_challenge`, `upsert_deal_evidence`, `confirm_deal_snapshot` | BUY evidence + lock |
| `settlement_mark_paid` (ops) | Trusted payment mark (no fake client PG) |
| `confirm_match_completion` | Bilateral complete (all types; BUY gated on PAID) |
| `cancel_deal`, `reopen_demand_after_trade_close` | Cancel / reopen |
| `block_user`, `unblock_user`, `submit_user_report`, `interaction_blocked_with` | Safety |
| `trg_demands_market_write`, `assert_tradable_demand` | KR-only writes during pilot (`20261009120000_market_partition_hardening.sql`) |

Migrations of note: `0013_buy_seller_connect_lifecycle.sql`, `0008_prevent_duplicate_connections.sql`, `0031_interaction_safety.sql`, `0042_connect_before_evidence.sql`, `20261005190000_complete_all_request_types.sql`, `0039_recoverable_trade_lifecycle.sql`, `20261009010000_market_country_currency.sql`, `20261009120000_market_partition_hardening.sql`.

### A.2 Existing e2e map

| Artifact | What it exercises | CI? |
|---|---|---|
| `scripts/e2e-two-user-local.mjs` (`npm run test:e2e:local`) | **API** two-user: BUY full (offer→interest→connect→chat→evidence→snapshot→payment gate→paid→complete) + cancel/reopen; BORROW/TASK/SERVICE respond→accept→chat→bilateral complete; outsider message RLS; trust | **Yes** — `.github/workflows/ci.yml` `supabase` job |
| `e2e/supabase/smoke.spec.ts` | **Browser UI** against local Supabase: consent signup; zero states; create all 4 types; BORROW/TASK/SERVICE two-session respond→accept→chat→complete | **Yes** — same job via `playwright.supabase.config.ts` |
| `e2e/browser/task-buy.spec.ts` + `helpers.ts` | **Remote** browser: TASK create→respond→accept→chat; BUY create→own→sell intent→interest→connect→chat | **No** — `npm run test:e2e:browser` needs `.env.local` |
| `scripts/e2e-two-user.mjs` / `e2e-security.mjs` | Remote API happy paths + RLS probes (foreign update, block pair, forged sell intent, etc.) | **No** — staging credentials |
| `e2e/visual/*` (incl. `location-japan.spec.ts`, `buy-search.spec.ts`, `dan-v1.spec.ts`) | Demo-mode visual / JA location UX / layout | **Yes** — `visual` job |
| Unit / pgTAP | `src/domain/*Lifecycle*.test.ts`, `store.hardening.test.tsx`, `paymentBoundary`, `SafePaymentPage.productionGate`; `supabase/tests/*.sql` (market, location, integrity) | **Yes** — `verify` + `supabase db test` |

### A.3 CI already proved vs still needs manual / staging proof

#### Proved in CI (local Supabase + unit + visual)

- Auth signup + consent gate (browser smoke).
- Create BUY / BORROW / TASK / SERVICE (UI smoke + API local).
- Non-BUY: respond → accept → chat (2 messages) → bilateral complete → demand CLOSED (API + UI).
- BUY API: Quick Offer without photo → interest → connect-before-evidence → chat → evidence → snapshot lock → completion blocked until ops PAID → handoff-ready → bilateral complete; cancel + reopen.
- Outsider cannot read private messages (local E2E).
- Blocked-pair rejection (security script locally only if wired; unit + migrations; remote security not CI).
- Market columns / JP write trigger / nearby execute grants (`supabase/tests/market_*.sql`, `location_discovery.sql`).
- Payment honesty: no fake “pay” in production/supabase mode (unit).
- JA location discovery chrome + `/create?country=JP` gated screen (visual demo).

#### Not proved in CI — needs staging / manual / device

| Gap | Why |
|---|---|
| BUY **browser** full chain (evidence UI → snapshot UI → payment gate UI → handoff → complete) | Smoke stops at create for BUY; browser e2e stops at chat connect |
| Report / block **UI** two-user | Only RPC/unit; chat ConfirmSheets not smoked |
| Cancel **UI** after CONNECTED (non-BUY + BUY) | API cancel covered; browser cancel sheet not |
| Realtime delivery / read receipts / reconnect banner | Checklist items; needs live Supabase sessions |
| Remote RLS security suite | `test:e2e:security` needs staging env |
| Cross-country leakage (query-param spoof, saved-area, notifications) | Handoff open item; backend enforcement partial |
| Native iOS geolocation permission / WebView | Visual is Chromium demo only |
| Phone/identity/payout verification UX for live BUY | Local E2E uses `ops_set_user_verification` |
| Production/staging deploy of market migrations | Spec forbids applying until approved |
| JP market browse with real JP rows | Writes gated; no real JP inventory |

### A.4 Location search audit

| Mode | Mechanism | Server vs client | Privacy notes |
|---|---|---|---|
| **nearby** | `search_nearby_demands_market(lat,lng,radius,limit,country,offset)` via `searchNearbyDemandDistancesRemote` | Server SECURITY DEFINER; 0.01° grid; ≥1 km buckets; rate limit 30/60s; country filter | No raw lat/lng out; `demand_exact_geo` owner-only; retired blind `search_nearby_demands` execute revoked; `approx_demand_distances` revoked |
| **area** | Client `matchesLocationDiscovery` on `region2` / `publicLabel` text (`locationDiscovery.ts`) | Client-only; no area RPC | Approximate label match; not km; not country-admin-code aware |
| **online** | Client: `REMOTE` or `SHIPPING` fulfillment | Client | Independent of GPS |
| **route** | Client: ROUTE option from/to label match; optional Google/Apple Maps links (`mapLinks.ts`) from **typed names only** + disclosure copy | Client; no corridor RPC (deferred D) | External map disclosure; no in-app ETA / tracking |
| **saved areas** | `savedAreas.ts` localStorage, max 3, country-tagged; rejects postcodes/coords/precise patterns | Client preference only | Not public home address |
| **market country** | `marketPrefs.ts` + feed `?country=`; independent of locale | UI + nearby RPC country arg; BUY aggregates forced KR | Language ≠ country |

Key files: `src/pages/DemandFeedPage.tsx`, `src/domain/locationDiscovery.ts`, `src/domain/requestRanking.ts`, `src/lib/geolocation.ts`, `src/lib/requestViewerGeo.ts`, `src/lib/savedAreas.ts`, `src/lib/mapLinks.ts`, `src/components/NearbyBandMap.tsx`, `supabase/migrations/20261009000000_private_nearby_discovery.sql`, `20261009010000_market_country_currency.sql`, `20261009120000_market_partition_hardening.sql`.

---

## B. Japan / i18n / JPY / policy gaps (no JP write unlock)

### B.1 Copy architecture

Two parallel dictionaries:

1. **`src/i18n/locale.ts` `messages.ko|ja`** — ~53 keys each; used heavily by Home / Feed / Settings / shell chrome via `translate` / `t()`. **JA coverage here is essentially complete for discovery/settings.**
2. **`src/copy/ko.ts` (462 keys) + `jaPilotCopy` in `src/copy/useDanCopy.ts` (~200 keys)** — create/respond/chat/status. Missing JA keys **fall back to Korean** (`{ ...ko, ...jaPilotCopy }`).

Category labels: `src/i18n/categories.ts` has full JA map; KO canonical labels live in `src/domain/types.ts` `CATEGORY_LABEL` (many hardcoded Hangul beyond `ko.*`).

### B.2 `jaPilotCopy` coverage vs `ko.ts`

- **ko keys:** 462  
- **jaPilotCopy keys:** 200  
- **Missing (Korean fallback when locale=ja):** **262**

#### Covered by `jaPilotCopy` (pilot — keep / extend)

Nav/create/auth/status/report/trade-cancel subset, including:

`brandTag`, `navCreate`, `navCreateShort`, `navFeed`, `navChats`, `navHome`, `displayName`, `logout`, `login`, `stepWhat`, `stepWhereWhen`, `stepNext`, `stepPrev`, `createTitle`, `createDesc`, `whatNeeded`, `pickDemandType`, `typeBuy`, `typeBorrow`, `typeTask`, `typeService`, `all`, `next`, `prev`, product/condition/price/borrow/task/service field keys, geo/place keys, fulfillment/task-mode keys, respond/accept/chat list keys, auth form keys, `report*` / `block*` / `tradeCompleteCta` / `tradeCancel*` / `matchStatusCompleted` / `activityMatchCompleted`, etc. (full list in `src/copy/useDanCopy.ts`).

#### Missing keys by bucket (concrete lists)

**Nav / home / feed chrome (20)**  
`navMy`, `navDemand`, `composerTitle`, `composerPlaceholder`, `composerHint`, `feedNowTitle`, `feedNowDesc`, `ctaCreate`, `ctaBrowse`, `featuredTitle`, `featuredDesc`, `feedTitle`, `feedDesc`, `homeCta`, `homeCtaHint`, `homeQuickHint`, `heroTitle`, `heroBody1`, `heroBody2`, `navActivity`

**My DAN / tabs / empties (29)**  
`myNow`, `myVault`, `myung`, `myBuyManage`, `myDan`, `tabOverview`, `tabDemands`, `tabOwned`, `tabSelling`, `tabMatches`, `tabResponses`, `statDemands`, `statOwned`, `statSelling`, `statMatches`, `myDescSuffix`, `myRequests`, `myResponses`, `emptyMyRequests`, `emptyMyResponses`, `archivedRequests`, `myConnections`, `myItems`, `signalMatch`, `signalOwned`, `signalResponse`, `nowEmpty`, `myRequestsActive`, `myRequestsDone`

**Match / trade lifecycle copy (36)** — critical for JA chat UX  
`connectedPeople`, `matchLead`, `matchStatusPotential`, `matchStatusInterested`, `matchStatusAccepted`, `matchStatusConnected`, `matchStatusDeclined`, `matchStatusClosed`, `tradeInProgress`, `tradeInProgressHint`, `tradeConfirmTitle`, `tradeConfirmBuy`, `tradeConfirmBorrow`, `tradeConfirmTask`, `tradeConfirmService`, `tradeConfirmAction`, `tradePeerConfirmed`, `tradePeerConfirmedHint`, `tradeConfirmPeerCta`, `tradeWaitingPeer`, `tradeDoneTitle`, `tradeDoneHint`, `tradePeerClosed`, `tradeClosedTitle`, `tradeClosedSeekHint`, `tradeReopenCta`, `tradeReopenBody`, `tradeReopenedToast`, `tradeReopenedHint`, `activityMatchTradeClosed`, `buyUntil`, `sellFrom`, `waitingSeller`, `connectedMsg`, `matchReady`, `matchHint`

**Sell / ownership / BUY offer (23)**  
`haveItTitle`, `ownershipNote`, `registerOwned`, `sellIntent`, `sellCta`, `sellFrom`, `sellTitle`, `sellPrompt`, `sellNotListing`, `sellSentenceEnd`, `minPriceLabel`, `relatedMatchesMid`, `relatedMatchesEnd`, `buyerExists`, `hopePrice`, `sellConsiderPrice`, `ownTitle`, `ownDesc`, `ownDoneBody`, `ownDoneTitle`, `ownAhaHigh`, `buyerSide`, `registerSame`

**Profile (15)**  
`profileArea`, `profileSave`, `profileActivity`, `profileCompleted`, `profileResponded`, `profileRecent`, `profileRecentEmpty`, `profileMyPosts`, `profileMyConnections`, `profileTitle`, `profileEdit`, `profileBio`, `profileBioPh`, `profileConnections`, `profileJoined`

**Activity (12)**  
`activityMatchTradeClosed`, `activityPeerConnected`, `activityExpiringSoon`, `activityTitle`, `activityEmpty`, `activityNewResponse`, `activityAccepted`, `activityDeclined`, `activityInterest`, `activityConnected`, `activityMessage`, `activityClosed`

**Chat leftovers (4)**  
`chatWith`, `chatPlaceholder`, `chatSend`, `chatEmpty`

**KR-centric categories / demo places (33)** — low priority for JA pilot; do not invent JP place names as “live inventory”  
`camera`, `lens`, `electronics`, `furniture`, `camping`, `other`, `errand`, `serviceCat`, `rental`, `sealed`, `likeNew`, `lightlyUsed`, `any`, `meetup`, `shipping`, `won`, `manWon`, `myung`, `noChange`, `seoul`, `gyeonggi`, `busan`, `daegu`, `incheon`, `mina`, `jun`, `hae`, `you`, `seongdong`, `mapo`, `haeundae`, `gangnam`, `pyeongtaek`

**Other product/UX strings (93)** — includes empties, filters, price thoughts, auth labels, etc.  
`demandFirstLead`, `respondToThisNeed`, `stepOf`, `moreActions`, `loadingChat`, `viewAllDemand`, `seekingSuffix`, `similarSeeking`, `priceHope`, `recent7d`, `highestIntent`, `searchPh`, `stepEssentials`, `stepOptional`, `optionalDetails`, `location`, `quotePrefix`, `priceDistEmpty`, `filterMore`, `suggestPrice`, `emptyBio`, `emptyBioSelf`, `authGoogle`, `authEmail`, `vaultOpen`, `sendInterest`, `connect`, `noSearch`, `noSearchBody`, `seekingOnly`, `highestHopeShort`, `thisWeek`, `bandSuffix`, `demoLogin`, `signup`, `loadFailed`, `dismiss`, `emptyHomeTitle`, `emptyHomeBody`, `untilSuffix`, `fromSuffix`, `noMatch`, `noMatchBody`, `viewMatches`, `newMatchesPrefix`, `newMatchesSuffix`, `resetDemo`, `missingProduct`, `missingOwn`, `missingOwnBody`, `currentHighest`, `seekersLabel`, `iWould`, `priceThoughtBuy`, `priceThoughtBorrow`, `priceThoughtReward`, `pendingMatches`, `areaUnset`, `setAreaForNearby`, `fabCreate`, `noAreaNearby`, `reviewDemand`, `seekingDetailSuffix`, `perDay`, `today`, `acceptResponse`, `attentionTitle`, `emptyArchived`, `seeAll`, `daysLeft`, `expiresToday`, `responseCountLabel`, `emptyFeed`, `emptyFeedBody`, `detailWhere`, `filterNearby`, `filterOnline`, `viewInMy`, `detailMissingBody`, `avgHope`, `priceDist`, `alreadyOwnedPrefix`, `leaveSellIntent`, `typeChip`, `responsesTitle`, `responseCountSuffix`, `saveDemand`, `expiredSection`, `expiredOnPrefix`, `repostDemand`, `viewRequest`, `markAllRead`, `timesSuffix`

### B.3 Screens / files still Korean-only or partially mixed

#### Import `ko` directly (bypass `useDanCopy` — JA never applied)

| File | Impact |
|---|---|
| `src/pages/MatchChatPage.tsx` | Complete/cancel/report/block sheets use `ko.*` including **missing** trade confirm keys |
| `src/pages/ProfilePage.tsx` | Report/block + trust copy |
| `src/pages/DemandItemPage.tsx` | Detail / respond chrome |
| `src/pages/DemandDetailPage.tsx` | Aggregate share strings hardcoded KO |
| `src/pages/DemandEditPage.tsx` | Edit UI |
| `src/pages/ActivityPage.tsx` | Activity list |
| `src/pages/OwnershipPage.tsx` | Ownership flow |
| `src/components/DemandCard.tsx`, `IndividualDemandCard.tsx`, `AggregatedDemandCard.tsx`, `MatchCard.tsx`, `PriceDistribution.tsx` | Cards |
| `src/components/layout/AppShell.tsx`, `shellMode.ts` | Nav labels from `ko` |
| `src/components/ui/Input.tsx`, `OverflowMenu.tsx` | Shared UI |
| `src/lib/format.ts` | Relative time / price thoughts always KO phrasing |
| `src/domain/types.ts`, `fulfillment.ts`, `aggregation.ts`, `mockData.ts`, `store.supabase.tsx` | Labels / errors |

#### Pages with substantial hardcoded Hangul (even if some `t()` / `useDanCopy`)

Priority for JA polish (still without JP writes):

- `ConsentPage.tsx` — entire consent UI Korean (`DAN 시작하기`, `이용약관 동의`, …)
- `AccountDeletionPage.tsx` — deletion copy Korean-only
- `SellIntentPage.tsx`, `OfferDetailPage.tsx`, `QuickOfferPage.tsx` — BUY seller path
- `TradeCompletePage.tsx`, `DealSnapshotPage.tsx`, `DealEvidencePage.tsx`, `SafePaymentPage.tsx`, `HandoffPage.tsx` — deal chain
- `MyDanPage.tsx`, `ConversationsPage.tsx`, `NotFoundPage.tsx`
- `CreateDemandPage.tsx` — dual `TYPE_META_KO` / `TYPE_META_JA` + many KO placeholders/phase strings; JP create gate OK
- `LoginPage.tsx` — partial JA inline ternaries (not dictionary)
- `DemandFeedPage.tsx` — filter option **constants** still Korean labels (rendered path often uses `t()`; aria-labels still KO)
- System: `AppErrorBoundary.tsx`, `NetworkStatusBanner.tsx`

#### Legal / support (static)

| Path | Language |
|---|---|
| `public/terms/index.html` | Korean only (`lang="ko"`), version 2026-10-07 |
| `public/privacy/index.html` | Korean only |
| `public/support/index.html` | Korean only |
| Settings links | `legalDocumentHref` → same KO pages; JA UI labels exist in `locale.ts` but documents are KO |

### B.4 JPY — what exists vs improve without enabling JP writes

#### Exists

| Layer | Detail |
|---|---|
| DB columns | `demands.country_code`, `demands.currency_code` with pair CHECK KR/KRW \| JP/JPY (`20261009010000_…`) |
| Write gate | `trg_demands_market_write` / `enforce_demand_market_write` rejects non-KR/KRW unless GUC `dan.allow_jp_market_write=on` (tests only) |
| Trade gate | `assert_tradable_demand` + response/match triggers — only KR/KRW tradable |
| Aggregates | `buy_demand_aggregates` hard-filters KR/KRW |
| Snapshots | `deal_snapshots.currency_code` KRW\|JPY |
| Display | `formatStoredMoney` / `formatKRWForLanguage` — **no conversion**; JA UI still shows KRW as KRW |
| Create UI gate | `CreateDemandPage` when `?country=JP` shows unavailable (JA+KO copy) |
| Create KR form | KRW notice in create flow (visual e2e asserts JA KRW notice) |
| Prefs | `marketPrefs` storefront independent of language |
| Tests | `marketMoney.test.ts`, `market_country.sql`, `market_partition_behavior.sql` |

#### Safe improvements (do **not** flip write gate / seed fake JPY)

1. Audit every money surface to pass `demand.currencyCode` / `snapshot.currencyCode` (cards, responses, chat, activity) — still KRW-only data.
2. Add JA copy for `wonNotice` already in locale; avoid `formatWon` / `만원` helpers in JA UI paths (use `formatStoredMoney`).
3. Placeholder / input grouping: today `formatDigitsGrouped` uses `ko-KR` — switch by locale without changing stored currency.
4. Keep JP create gate + DB trigger; add a unit/UI test that REST insert `country_code=JP` fails for authenticated role.
5. Document that browse-JP nearby RPC may return empty until approved seed under controlled GUC — empty state copy only.

### B.5 Address / country separation gaps

| Need (launch plan) | Current | Gap |
|---|---|---|
| Prefetchure / `region1_code` | Free-text `region1` from Nominatim `state`/`province` | No JP 都道府県 code enum; no KR admin code |
| City/ward `region2_code` | Free-text `region2` | String match only; cross-country name collisions possible |
| Postal | Explicitly **rejected** in saved areas | No validated JP 〒123-4567 or KR postal field on requests (by design for public labels) |
| Timezone | Not stored per demand/area | Dates use browser/`ko-KR`/`ja-JP` locale formatting; no `Asia/Tokyo` persistence |
| Country on fulfillment place | Demand-level `country_code` only | Place objects lack country; area search not country-scoped server-side |
| Structured JP address UX | Manual label + OSM reverse geocode | No prefecture→city picker scaffolding |

Relevant: `src/domain/fulfillment.ts` (`Place`), `src/lib/geolocation.ts`, `src/lib/savedAreas.ts`, `docs/FULFILLMENT_MODEL.md`.

### B.6 Policy / legal status

| Asset | Status |
|---|---|
| Terms / Privacy | Korean HTML only; consent versions `2026-10-07` (`consentVersions.ts` + DB requirements) |
| Support | Korean HTML; email contact |
| Consent UI | Korean-only page; JA locale users still see KO legal acceptance text |
| Account deletion | Korean UI; deletion edge function exists; JA one-liner on login after delete |
| App Store JP metadata | Draft only: `docs/DAN_JAPAN_APPSTORE_METADATA_DRAFT.md` |
| JP APPI / consumer / secondhand legal review | Explicitly deferred until writes unlock |

---

## Recommended smallest safe increments

Ordered for value **without** unlocking JP create/write (`dan.allow_jp_market_write`, `/create?country=JP` authoring, JP seed data).

### Increment 1 — JA dictionary expansion (copy-only)

1. Add `jaPilotCopy` entries for **Match/trade** + **chat leftovers** + **activity** buckets (~52 keys) first — unblocks JA chat complete/cancel language when pages switch to `useDanCopy`.
2. Wire `MatchChatPage`, `ProfilePage`, `ActivityPage`, `DemandItemPage` to `useDanCopy()` instead of raw `ko`.
3. Add My DAN empty/tab keys next (~29).

**Keep gated:** no change to create country param, no currency write path.

### Increment 2 — Hardcoded screen pass (still KR market)

1. Consent + Account deletion JA strings (or `public/terms-ja/`, `privacy-ja/` **draft** pages linked only when locale=ja, with banner “日本向け契約は準備中 / 現行は韓国法準拠の原文”).
2. Replace `DemandFeedPage` Korean constant labels with `t()` only (cleanup).
3. `formatRelativeTime` / `formatPriceThought` locale branches.

### Increment 3 — Country/address UX scaffolding (display + prefs only)

1. Typed `AdminRegion` helper: KR vs JP label examples in placeholders (`locale.ts` already has mixed examples).
2. Optional `timezoneHint` display from selected market (`Asia/Seoul` vs `Asia/Tokyo`) in Settings — **not** persisted on demands yet.
3. Prefetchure/city **combobox UI stub** behind feature flag that still writes only `publicLabel`/`region2` text on KR creates; JP create remains blocked.
4. Ensure area search filters by selected `areaCountry` client-side on `demand.countryCode` (ranking already does) everywhere including deep links.

### Increment 4 — Money display hardening (no JP amounts)

1. Grep/fix remaining `formatWon` / `` `${n}원` `` in JA locale paths.
2. Snapshot/chat always show `currencyCode` badge when non-default in future; today always KRW.
3. Keep CI tests asserting no KRW→JPY conversion on language flip.

### Explicit non-goals until approval

- Removing `trg_demands_market_write` / setting `dan.allow_jp_market_write`
- Seeding JP/JPY demands or products
- Enabling `/create?country=JP` form
- JP payment / escrow / legal terms as binding JP law documents
- Route corridor RPC / background GPS

---

## Quick reference — CI command surface

```bash
npm run typecheck && npm run lint && npm test && npm run build   # verify job
npm run test:e2e:local                                           # CI supabase job
npx playwright test --config=playwright.supabase.config.ts       # CI browser smoke
npx playwright test e2e/visual --config=playwright.visual.config.ts
# staging / manual:
npm run test:e2e:browser
npm run test:e2e:remote
npm run test:e2e:security
```
