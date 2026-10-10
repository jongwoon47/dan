# DAN commercialization status (rolling)

## Identity

| Field | Value |
|---|---|
| BRANCH | `cursor/dan-commercial-complete-e0e7` |
| HEAD | see `git rev-parse HEAD` |
| PR | #36 → `feature/dan-v3-real-app-ui` |
| Handoff | `docs/DAN_COMMERCIAL_HANDOFF_20261009.md` |
| Ready | **NO** |

## Implemented this continuation

- MatchChat: preserve blocked/send errors across poll/focus reload
- store.supabase: harden blocked PostgrestError parsing
- safety-and-buy E2E: BUY title in `main`; block probe scoped to `.chat-thread`
- `demandTypeLabel` helper + MyDan / DemandItem / feed card / feed search JA
- demo profileTrust locale for recent activity labels
- `prepareBuyPaidDeal` + BUY dispute pause browser E2E

## Test matrix

| Suite | Result | Notes |
|---|---|---|
| typecheck | PASS (local) | |
| unit (selected) | PASS | profileTrust, jaTradeCoverage |
| CI tip | PENDING | watch `cursor/dan-commercial-complete-e0e7` |
| staging DB apply | BLOCKED | credentials + approval |
| iPhone device | BLOCKED | no Mac/device |
| JP legal APPI | BLOCKED | human review |
| JP write unlock | NOT DONE | gated intentionally |
| real PG | NOT DONE | honesty gate only |

## Korea trades

| Item | Status |
|---|---|
| BUY/BORROW/TASK/SERVICE API 2-user (CI local) | VERIFIED (prior) |
| Browser smoke non-BUY complete | VERIFIED (prior) |
| BUY browser evidence→ops paid→handoff→complete | IMPLEMENTED — tip CI |
| BUY dispute pause after PAID | IMPLEMENTED — tip CI |
| Report/block/cancel UI two-user | IMPLEMENTED — tip CI |

## Japan readiness

| Item | Status |
|---|---|
| JA UI dictionary + major screens | PARTIAL (pilot) |
| Demand type labels JA | IMPLEMENTED |
| JPY display without conversion | PASS |
| JP create/write | GATED |
| JA legal HTML drafts | drafts only |
| Japan store Ready | **NO** |

## Approval-required next

1. Staging migration apply per drift docs
2. Staging security + BUY browser E2E
3. iPhone TestFlight QA
4. Legal APPI review
5. JP write unlock for one pilot city
6. main / prod / store — never without explicit approval
