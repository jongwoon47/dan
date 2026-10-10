# DAN commercialization handoff

**Do not treat older status docs as HEAD without checking `git rev-parse`.**

| Field | Value |
|---|---|
| BRANCH | `cursor/dan-commercial-complete-e0e7` |
| Base for PR #36 | `feature/dan-v3-real-app-ui` |
| Also tracks | ff history toward `feature/dan-location-jp-launch-plan-20261009` |
| Tip | `2224216` (or newer — always `git rev-parse HEAD`) |
| PR | https://github.com/jongwoon47/dan/pull/36 |
| Ready | **NO** (no JP store Ready; no staging/prod write; no main merge) |

## Latest work (this re-entry)

1. **Block send UI race** — `MatchChatPage.load()` no longer clears composer/send errors on poll/focus success. Blocked send keeps `copy.chatBlockedSend` visible. PostgrestError `message/details/hint/code` parsed for `/blocked/i`.
2. **BUY E2E strict mode** — product title assert scoped to `main` (header + page both use name).
3. **MyDan / feed / detail JA types** — `src/copy/demandTypeLabel.ts`; DEMAND_TYPE_LABEL hardcoding removed from MyDan, DemandItem chip/header, IndividualDemandCard; feed search matches KO+JA type names; demo `profileTrust` locale-aware.
4. **Dispute browser E2E** — `prepareBuyPaidDeal` helper; new test opens dispute after ops PAID and asserts handoff completion CTA removed + pause copy.

## Next agent (no user questions)

1. Confirm CI green on tip (`d575751` or newer): verify + visual + supabase (safety block UI, BUY complete, BUY dispute, smoke).
2. If block UI still fails: download Playwright failure screenshot; confirm error node `.form-error` and that peer session is blocked pair.
3. Residual JA: MatchCard stage ternaries → copy keys; DemandItem remaining locale ternaries; AccountDeletion KO strings.
4. Staging apply / JP write unlock / main / store / real PG / Ready → **BLOCKED** (ask human). Never touch PAN; protect in-review DAN app.

## Scorecard snapshot (update after CI)

| Area | Status |
|---|---|
| BUY browser complete (CI local) | IMPLEMENTED — re-verify on tip |
| BUY dispute pause (CI local) | IMPLEMENTED — awaiting tip CI |
| Report/block/cancel TASK UI | IMPLEMENTED — block UI fix awaiting tip CI |
| BORROW/TASK/SERVICE browser complete | VERIFIED (prior green CI) |
| JA demand type labels (MyDan/feed/detail) | IMPLEMENTED |
| Staging DB apply | BLOCKED |
| JP write unlock / legal / device QA | BLOCKED |
| Japan Ready | **NO** |

## Constraints

- Never: staging/prod DB write, JP write unlock, main merge, App Store submit, real payment enable, Ready declaration.
- Do not weaken test expectations to greenwash CI.
