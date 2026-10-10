# DAN commercialization handoff

**Do not treat older status docs as HEAD without checking `git rev-parse`.**

| Field | Value |
|---|---|
| BRANCH | `cursor/dan-commercial-complete-e0e7` |
| Base for PR #36 | `feature/dan-v3-real-app-ui` |
| Also tracks | FF-synced with `feature/dan-location-jp-launch-plan-20261009` |
| Tip | always `git rev-parse HEAD` |
| PR | https://github.com/jongwoon47/dan/pull/36 (#31 launch-plan also tip-synced) |
| Ready | **NO** |

## Green CI baseline

| Ref | Result |
|---|---|
| `1d64896` | **SUCCESS** on #36, #31, and #30 (verify + visual + supabase) |
| Includes | block UI, BUY complete, BUY dispute, smoke BORROW/TASK/SERVICE |

## Latest work

1. Block send UI race + PostgrestError blocked parse
2. BUY E2E + dispute E2E (`prepareBuyPaidDeal`)
3. Evidence save flake: `upsertDealEvidence` no longer silent-null on mutation lock
4. JA: demandTypeLabel, MatchCard/Conversations stages, live profile, ProductVisual categories
5. JA dictionary: MyDan / TradeComplete / Profile trust chrome → `useDanCopy`
6. Residual: BuyDemandCreatePage JA; AccountDeletion KO; fully deprecate `DEMAND_TYPE_LABEL`

## Next agent

1. Confirm tip still green after any new push.
2. BuyDemandCreatePage JA + AccountDeletion strings.
3. Staging / JP unlock / main / store / Ready → **BLOCKED**. Never touch PAN.

## Scorecard

| Area | Status |
|---|---|
| BUY browser complete | **VERIFIED** (`1d64896` CI) |
| BUY dispute pause | **VERIFIED** |
| Report/block/cancel TASK UI | **VERIFIED** |
| BORROW/TASK/SERVICE browser | **VERIFIED** |
| JA demand/profile/category/MyDan/complete | IMPLEMENTED (native QA still recommended) |
| Staging DB apply | BLOCKED |
| JP write unlock / legal / device QA | BLOCKED |
| Japan Ready | **NO** |

## Constraints

- Never: staging/prod DB write, JP write unlock, main merge, App Store submit, real payment enable, Ready declaration.
- Do not weaken test expectations.
