# DAN commercialization gates status (2026-10-09)

**Baseline CI:** `d6f3670` — verify + visual + supabase all green ([37933373815](https://github.com/jongwoon47/dan/actions/runs/37933373815))  
**Working branch:** `cursor/dan-commercial-gates-e0e7` → integrate into `feature/dan-location-jp-launch-plan-20261009` / PR #31  
**Ready:** **NO** — do not mark PR ready for release.

## Gate checklist

| # | Gate | Status | Evidence / notes |
|---|---|---|---|
| 0 | Full CI on commercial HEAD | **PASS** | `d6f3670` |
| 1 | Staging DB ledger read-only + apply plan | **PLAN DONE / LIVE READ BLOCKED** | `docs/STAGING_MIGRATION_APPLY_PLAN_20261009.md` — agent lacks staging DB credentials |
| 2 | KR BUY/BORROW/TASK/SERVICE + location | **CI PASS / staging UI partial** | Local API+browser smoke in CI; BUY browser evidence→pay still staging/manual; audit `docs/DAN_COMMERCIAL_KR_JP_AUDIT_20261009.md` |
| 3 | JA unfinished screens / JPY / country·address / policy | **PARTIAL** | Trade/chat/activity JA keys + MatchChat `useDanCopy`; consent JA UI + KR legal disclosure; JP address/timezone scaffolding (`src/lib/jpAddress.ts`); **JP create/write still gated** |
| 4 | Items agent cannot perform | **BLOCKED** | See below |
| 5 | PR #31 updated with results | **THIS DOC + PR comment** | Keep draft; no Ready |

## BLOCKED (owner / external)

| Item | Why | Owner action |
|---|---|---|
| Staging `schema_migrations` live query | No staging DB URL / management token in agent env | Run SQL in apply plan §3; paste results |
| Staging migration apply | Requires explicit approval | Approve after ledger review |
| Real iPhone location / locale / WebView | No Mac/iPhone in this agent | TestFlight device QA |
| Japanese legal terms/privacy (APPI) | Needs qualified local legal review | Review drafts; replace `public/terms`/`privacy` when approved |
| JP market write unlock / pilot city activate | Spec + DB GUC gated | Separate go/no-go after JA+JPY+policy PASS |
| `main` merge / prod deploy / App Store submit | Release authorization | Separate approval |

## Implemented this segment (code)

- Staging apply plan (read-only prep)
- JA critical trade/chat/profile/activity dictionary coverage + MatchChat wired to `useDanCopy`
- Consent screen localized; JA shows “KR legal original pending JP review” disclosure
- JP prefecture / postal / timezone helpers + tests (no write unlock)
- Settings timezone vs language note; JP create gate shows address/legal/timezone hints

## Still incomplete (not Ready)

- Remaining ~200+ `ko.ts` keys without JA (sell/ownership/deal chain pages still import `ko` or hardcode)
- Account deletion JA; static JA legal HTML
- Structured JP address DB fields
- Staging security E2E + BUY browser full chain against staging
- Real JP inventory / JPY write path (intentionally blocked)

## Approval-required actions (do not do without ask)

운영 DB 변경 · `main` 병합 · 프로덕션 배포 · 앱스토어 제출 · 일본 출시/쓰기 활성화
