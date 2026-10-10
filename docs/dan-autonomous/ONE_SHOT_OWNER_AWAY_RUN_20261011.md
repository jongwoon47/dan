# DAN one-shot autonomous development while owner is away

**Purpose:** One owner message should start the longest *safe, productive* autonomous development run available in the executing Cursor Agent. No repeated requests for screenshots, routine code approvals, or status acknowledgements.

**Repository:** `jongwoon47/dan`
**Only allowed development branch:** `automation/dan-autonomous-review-loop-20261010`
**Existing draft PR:** #37, base `cursor/dan-commercial-complete-e0e7`
**Starting reference (historical, VERIFY BEFORE USE):** C023 code review PASS @ `3df98fc3a7f059d945ecc88570dd742bbd4cd79d`; historical 253 unit tests. The current branch may have moved. **Live Git state and `docs/dan-autonomous/loop_state.json` take precedence over this historical description.**
**Authority:** No merge, deployment, remote DB write, store submission, paid external service enrollment, or Japan market write activation without separate explicit owner approval.

## 0. Mandatory boot (do not skip)

1. Open this exact repository. Inspect `git status --short`, current worktrees, `git remote -v`, `git fetch origin`, local and remote branch HEAD, PR #37 and newest CI run. Preserve pre-existing uncommitted work. If necessary use a fresh worktree based on the specified branch; do not reset, force-push, silently rebase, or overwrite concurrent agent commits.
2. Read `docs/dan-autonomous/START_AUTONOMOUS_RUN.md`, `REVIEW_PROTOCOL.md`, `CI_COST_POLICY.md`, `loop_state.json`, `docs/DAN_COMMERCIALIZATION_SPEC_V1.md`, `docs/CURSOR_DAN_HANDOFF_20261009.md`, current migrations and existing safety rules.
3. Reconstruct **current** P0/P1/P2 state from implementation and evidence. Read every unresolved issue, the latest independent review and `screen_audit`, and identify missing end-to-end journeys. Do not revert, re-do or rewrite previously verified fixes without evidence.
4. Update/extend existing backlog and `screen_audit` with a runnable, deduplicated acceptance matrix for all distinct screens and all four transaction types. Prioritize user-impact and security over code churn and test-count inflation. Limit new feature scope to the existing DAN product specification.

## 1. Owner-away mission: all currently executable work, no periodic approval pings

Work through the following **in priority order** without asking for approval for normal source edits, local test accounts, local ephemeral DB validation, UI fixes, test changes or draft-branch commits. If a task needs a protected external action, write a precise BLOCKED owner action and **continue other safe tasks**.

### A. Critical correctness, transactional trust and security

- First inspect changes since the last proven comprehensive CI. Protect login, required consent, account deletion, report/block, server-side country/currency checks, RLS, SECURITY DEFINER, location privacy, ownership, expiration, duplicate actions, race conditions and transactional consistency.
- Complete the real BUY/BORROW/TASK/SERVICE lifecycle with two isolated local accounts from creating a request through discovery, response/offer, connect, chat, cancel/reopen, dispute/report/block, and both-party completion.
- BUY chain is essential: `OfferDetail`, `DealSnapshot`, `SafePayment`, `Handoff`, `TradeComplete`; inspect navigation, amount/currency labels, evidence, payment gate (PAID is server-controlled), handoff/complete authorization, retry, timeout, duplicate tap, expired/blocked status and reliable rollback/feedback. Never fake payment processor, escrow, ownership or settlement.
- Add meaningful negative and concurrent tests; fix observed failures without weakening constraints or deleting tests. Keep remotely deployed migration history immutable; new migrations must be forward-only, local-tested and approved before remote apply.

### B. Commercial-grade UX: actual rendered app, not screenshots imagined by text

- Audit and fix ALL reachable screens, including Home, Explore/Feed, search/filter, nearby/route, category-specific Create/Detail, OfferDetail, ownership, chat/list, MyDan, profile, account deletion, required consent, Settings, report/block, error/offline/loading/empty, DealSnapshot, SafePayment, Handoff, TradeComplete and support.
- Use the actual browser/Playwright or available computer UI (not only static reading). Test 390px/720px/1180px/1440px and a range of text lengths, KO/JA, keyboard navigation, focus, dynamic content, empty vs loading vs error, auth and permission-denied views. Where a real native device is not accessible, record NATIVE_BLOCKED; browser emulation is not an iPhone test.
- Keep an **evidence-backed per-screen checklist** in `loop_state.json.screen_audit`: observed state, exact route, viewport, code SHA, artifact path, failure, repair, reviewer evidence, resolved or blocked. Do not mark screens COMPLETE based solely on unit tests.
- Polish information hierarchy, readable typography, constrained line length, consistent 44px+ touch affordances, spacing, sensible copy, accessible headings/labels, real data handling, graceful errors and honest completion states. Preserve existing coherent visual design; avoid sweeping aesthetic rewrites or unapproved large redesigns.

### C. Useful location and Japanese pilot readiness

- Validate opt-in nearby with denied/expired/revoked permission and manual area fallback; bounded pagination, trustworthy region/filter precedence, cross-market separation, routes FROM→TO only, approximate rather than precise public location, and server enforcement. **Measure** performance only against an available representative test environment; do not invent latency, geocoding coverage, route ETA or map licensing.
- KO/JA copy, persisted locale vs market vs stored currency/timezone, Japan prefecture/city/address fields, fraud/safety/reporting, translation status, privacy/support/error/help and App Store draft information. Guard JP create/trade writes until security and legal approval; do not turn it on just to make a UI look complete.
- Prepare human-facing legal/APPI, pilot geography, payment provider and TestFlight acceptance checklists. Never say legally approved, Apple device PASS or Japan commerce LIVE without corresponding real evidence.

### D. Final product regression and consistency pass

- Walk realistic scenarios as a stranger/user, including auth, first transaction, many requests, partial failure, recovery after refresh, denied GPS, zero results, slow network, account removal, multiple devices/sessions where feasible, privacy leakage and content reporting.
- Reduce needless duplicated code and contradictory product language **only where observable value improves**. Do not add speculative unrelated features, mock user inventory or rewrite settled architecture.

## 2. Actual implement → test → separate review → fix loop

For **each coherent patch batch**:
1. Define a bounded acceptance case; reproduce defect with actual evidence or a clear requirement gap.
2. Implement and add focused regressions. Locally run relevant tests and typecheck; at meaningful checkpoints run lint/build/full local suites.
3. Commit code to the allowed branch. Freeze the **exact code commit SHA**.
4. Invoke **a real separate read-only `dan-independent-reviewer` context** on the exact SHA, with diff, acceptance criteria, tests, security/privacy risks and artifacts. Capture real invocation/task ID, reviewed SHA, verdict and actionable findings. Implementer self-review is NOT independent review. An unavailable subagent = REVIEW_BLOCKED, not PASS.
5. If findings are actionable, fix them, test again, commit new SHA and **invoke a fresh review on the new SHA**. Repeat until no fixable P0/P1 findings for that batch.
6. Append the cycle, commands/outcomes, review evidence, open gaps and next exact action to `docs/dan-autonomous/loop_state.json`. Run `node scripts/validate-dan-loop-state.mjs` before checkpoint commit. Keep PR #37 a **draft** and push incremental safe commits. Never mislabel a skipped or stale check as PASS.
7. Move to the next runnable task rather than stopping for a routine progress summary. Do not inflate completion status by merely counting reviews or commits.

If parallel reviewer/implementer agents have overlapping file writes, serialize them, and verify `origin` head before push. Use a fresh worktree if necessary; preserve checkpoints from all agents.

## 3. Cost-aware CI policy (no repetition, but do not omit required evidence)

Follow `docs/dan-autonomous/CI_COST_POLICY.md`.

- Ordinary code fixes: targeted **local** tests and separate code review. Keep PR draft so automatic Actions runner jobs are skipped.
- After a complete critical DB/security/transaction bundle, isolated Supabase pgTAP and two-user E2E must be run locally or by one justified full GitHub Actions checkpoint; do not wait indefinitely if local DB is unavailable and Actions can genuinely run.
- **After all safely executable feature/UX batches are stable**, freeze a checkpoint with committed code and reviewer outcomes. Verify no same-SHA `suite=full` queued/running/successful, then dispatch `bash scripts/dan-ci-checkpoint.sh full` **once for that code checkpoint** if available and without purchasing/raising paid limits.
- Verify `verify`, `supabase`, and `visual` against the exact SHA with run URLs, 4-type E2E and visual artifacts. If a legitimate failure occurs, inspect, fix, independent-review the changed SHA, and re-run full CI on the fixed SHA. Do not retry unchanged failures in a loop or run repetitive suites to appear busy. If dispatch cannot start, record CI_DISPATCH_BLOCKED.
- Reconfirm all final code tests after any code change. **Do not create a needless docs-only HEAD commit after a full CI and then claim exact HEAD validation**. Publish final CI evidence in a draft PR comment/artifact if it cannot be committed without advancing HEAD. `loop_state.json` may record `last_full_ci_sha` on a later checkpoint, but note plainly when it differs from current HEAD.
- Do **not** mark READY/COMPLETE if security, payments, transaction, real-device or remote gates are unresolved; use scoped `CODE_COMPLETE_WITH_EXTERNAL_GATES` or `PARTIAL` and keep the draft unmerged.

## 4. Hard human-approval boundaries (never bypass just because owner is away)

- No `main` / production or staging merge/deploy; no change to an existing submitted App Store build, TestFlight upload, metadata, availability, or real user data.
- No remote staging/production DB migrations, seed/data updates, Supabase project modifications, production privileges or JP create/unlock.
- No enabling live paid payment/escrow, third-party paid APIs, cloud/runner billing upgrades or license purchases. Existing authorized CI allocation may be used at the planned checkpoint; if further paid usage is required, BLOCKED.
- Never log credentials, personal content or precise location; never fake business, users, physical inventory, iOS devices, licensing, compliance or screenshots.
- No modification to PAN or unrelated repositories.

Record each external gate with `id`, `why`, `attempted_safe_evidence`, `exact_owner_action`, `risk`, and `safe_remaining_work`.

## 5. Long-absence checkpoint and truthful stopping criteria

At each checkpoint and before environment timeout/context exhaustion, commit and push safe work, validate the state JSON, and leave a clear `next_action` that a **new Cursor agent can immediately execute** without screenshots or re-explanation.

Continue in the current execution session while:
- there are still concrete safe, testable tasks,
- the environment's time/token/tool budget permits,
- and no protected external action is required.

Do not run forever, perform meaningless edits, or promise to continue once the Cursor job/session actually ends. An unattended *cross-session* implementer/reviewer controller is NOT configured by these documents; automatically starting future sessions would require separately approved API credentials, spending controls, monitoring and tested orchestration. Do not invent a background daemon.

Stop only on real execution-session end, actual exhaustion of all safe work, or a necessary owner/security gate. If all safe work is complete, write a truthful final acceptance matrix:

- `CODE_STATUS`: CODE_COMPLETE_WITH_EXTERNAL_GATES / PARTIAL, never "perfect".
- `SCOPE`: each screen and BUY/BORROW/TASK/SERVICE flow, tested on which environment
- `LATEST_CODE_SHA` and `REVIEWED_SHA`: exact values, independent reviewer invocation IDs
- `TESTS`: typecheck/lint/unit/build/Supabase pgTAP/two-user/browser/visual, with PASS/FAIL/BLOCKED/NOT_RUN + artifact and SHA
- `LATEST_FULL_CI_SHA`, run URL, and whether it matches current source HEAD
- `BLOCKERS`: remote staging ledger/apply, real iOS/TestFlight, Japan legal/APPI/JPY/write enablement and any other actual blockers
- `PR`: #37 remains Draft, branch remote HEAD, unmerged and undeployed
- `NEXT_OWNER_ACTIONS`: only actions requiring human consent/account access; brief and ordered
- `NEXT_AGENT_ACTION`: one precise runnable instruction if work remains.

**A full CI green result is not a substitute for actual device, legal, staging and production authorization.**
