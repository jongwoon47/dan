# DAN commercialization handoff

**Do not treat older status docs as HEAD without checking `git rev-parse`.**

| Field | Value |
|---|---|
| BRANCH | `cursor/dan-commercial-complete-e0e7` |
| Base for PR #36 | `feature/dan-v3-real-app-ui` |
| Also tracks | FF-synced with `feature/dan-location-jp-launch-plan-20261009` |
| Tip | always `git rev-parse HEAD` on complete branch |
| PR | https://github.com/jongwoon47/dan/pull/36 |
| Ready | **NO** (no JP store Ready; no staging/prod write; no main merge) |

## Latest work (this re-entry)

1. **Block send UI race** — `MatchChatPage.load()` no longer clears composer/send errors on poll/focus success. Blocked send keeps `copy.chatBlockedSend` visible. PostgrestError `message/details/hint/code` parsed for `/blocked/i`.
2. **BUY E2E** — product title assert scoped to `main`; `prepareBuyPaidDeal` shared helper.
3. **Dispute browser E2E** — after ops PAID, open dispute → pause copy + handoff confirm CTA gone.
4. **JA demand types** — `src/copy/demandTypeLabel.ts` on MyDan / DemandItem / IndividualDemandCard; feed search KO+JA; demo `profileTrust` locale-aware.
5. **MatchCard / Conversations stages** — copy keys (`matchStage*`, `matchStatusWaitingAccept`, …).
6. **Live profile + ProductVisual JA** — `fetchPublicProfile` auth/type/status via locale copy; `categoryLabel` on ProductVisual/CategoryPill; `openDealDisputeRemote` unit test.
7. Gap audit residual: MyDan/TradeComplete/Profile/BuyDemandCreate inline ternaries → dictionary; fully deprecate `DEMAND_TYPE_LABEL`.

## Next agent (no user questions)

1. Confirm CI green on tip: verify + visual + supabase (block UI, BUY complete, BUY dispute, smoke).
2. If block UI still fails: download Playwright failure screenshot; confirm `.form-error` and blocked pair.
3. Residual JA dictionary work above.
4. Staging apply / JP write unlock / main / store / real PG / Ready → **BLOCKED**. Never touch PAN; protect in-review DAN app.

## Scorecard snapshot (update after CI)

| Area | Status |
|---|---|
| BUY browser complete (CI local) | VERIFIED on #36 `fc515c8`; evidence-save retry on `e3ebd6a` for launch-plan flake |
| BUY dispute pause (CI local) | VERIFIED on #36 `fc515c8` |
| Report/block/cancel TASK UI | VERIFIED on #36 `fc515c8` (block error race fixed) |
| BORROW/TASK/SERVICE browser complete | VERIFIED |
| JA demand type / profile / category labels | IMPLEMENTED |
| Staging DB apply | BLOCKED |
| JP write unlock / legal / device QA | BLOCKED |
| Japan Ready | **NO** |

## Constraints

- Never: staging/prod DB write, JP write unlock, main merge, App Store submit, real payment enable, Ready declaration.
- Do not weaken test expectations to greenwash CI.
