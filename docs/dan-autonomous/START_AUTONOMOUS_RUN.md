# DAN autonomous build / review loop — START

**Repository:** jongwoon47/dan
**Execution branch:** automation/dan-autonomous-review-loop-20261010
**Baseline:** cursor/dan-commercial-complete-e0e7 (capture live origin SHA at start)
**Scope:** DAN commercialization, KR BUY/BORROW/TASK/SERVICE, safe location, JA readiness. No PAN changes.
**Authority:** Ordinary branch code changes, tests, documentation, isolated local DB, and draft PR are authorized. Merges/releases/remote DB writes are not.

## A. Boot sequence (mandatory)

1. Read this file, docs/dan-autonomous/CI_COST_POLICY.md, docs/dan-autonomous/REVIEW_PROTOCOL.md, docs/dan-autonomous/loop_state.json, docs/CURSOR_DAN_HANDOFF_20261009.md, docs/DAN_COMMERCIAL_KR_JP_AUDIT_20261009.md, docs/STAGING_MIGRATION_APPLY_PLAN_20261009.md, docs/STAGING_DRIFT_RECONCILIATION_20261009.md, and .cursor/rules/dan-safe-development.mdc.
2. Verify the checkout is jongwoon47/dan. Read git remote -v, git status --short, git branch -vv, and fetch origin. Never reset, clean, force-push, overwrite unrelated local work, or transplant unreviewed changes.
3. Work only on automation/dan-autonomous-review-loop-20261010, tracking origin. If it cannot be checked out safely because of uncommitted changes, use an isolated worktree. If latest baseline has advanced, inspect and reconcile deliberately before rebasing; do not silently discard work.
4. Revalidate the real current upstream commit and newest relevant CI jobs. Dated SHA and older PASS are historical evidence only. Update docs/dan-autonomous/loop_state.json with accurate baseline, running HEAD, blockers, and test evidence.
5. Assess remaining backlog using source/tests and add clearly scoped items. P0 before P1 before P2. Do not reimplement completed work simply to create activity.

## B. Engineering priorities

P0: Verify and fix present CI, migration replay, security and RLS/SECURITY DEFINER boundaries, two-account four-type transactions, buy payment-gate correctness, consent and deletion, KR/JP isolation, location privacy/deny behavior, loading and empty/error states. Use actual updated HEAD and an ephemeral Supabase database. Remote staging drift is a **read-only inspection**; never apply SQL to staging without specific approval.

P1: Polish real KR marketplace UI, accessible readable text, mobile widths (390/720/1180/1440), low-noise chat, full task flow and report/block UX. Improve nearby/region/route candidate relevance and measurable query performance without precise GPS exposure. Verify account settings and real user onboarding, do not manufacture listings.

P2: Complete Japanese locale coverage and honest JP pilot readiness; ensure locale is separate from country and currency. Prepare legal and storefront drafts for human approval. Keep JP request creation and trading gated until backend country/security tests and explicit product/legal/release approval. No false JPY conversion or unverified paid payment claims.

Use docs/DAN_COMMERCIALIZATION_SPEC_V1.md as a product specification and the newer code/state as the factual implementation baseline. Explicitly distinguish already done, needs verification, actionable fix, and external blocker.

## C. Actual autonomy loop (repeat within the live agent session)

For EACH scoped unit of work:

1. Select one highest-priority runnable issue from loop_state.json. Establish failing reproduction or concrete acceptance criteria, risk, tests, and file scope.
2. Implement a minimal patch on this branch. Add regression tests when possible, preserving security, consent, existing data, and transaction contracts.
3. Follow docs/dan-autonomous/CI_COST_POLICY.md: run **targeted local tests per patch**, broader local verification at coherent checkpoints, and full Supabase/two-user E2E/visual on significant security/DB/trade or release checkpoint SHA. Do not require repeated npm ci or full GitHub CI on every small commit. Local Supabase is preferred if usable; otherwise dispatch full CI at a stable milestone when Actions is available and authorized. Mark genuinely unrun steps BLOCKED or NOT_RUN, never PASS.
4. **Invoke the separate, readonly Cursor subagent dan-independent-reviewer** in its own context, passing the precise branch diff, acceptance criteria, threat model, tests, and current commit. If Codex CLI/Cloud is independently available, a Codex review can be added, but do not claim it ran unless there is observable execution evidence. The implementer cannot substitute its own self-review for a separate invocation.
5. Store reviewer identity/tool, reviewed commit SHA, start/end or run reference, verbatim actionable findings, test output links/log paths, and verdict in docs/dan-autonomous/loop_state.json according to REVIEW_PROTOCOL.md. Reviewer must explicitly inspect code/tests. If subagent invocation is unavailable, record REVIEW_BLOCKED and its specific reason; no VERIFIED/READY verdict.
6. Fix all actionable P0/P1 reviewer findings; rerun affected tests; invoke a **new independent review of the updated HEAD**. The earlier approval is invalidated when code changes. Repeat implementation → tests → separate review → fixes until no executable findings remain or a genuine external blocker/budget prevents continuation.
7. Make small reviewable commits, push this branch if authorization and credentials allow, update **draft** PR/evidence against the appropriate integration base only after inspecting ancestry. **Keep the PR draft while iterating**; a draft commit should not spend runner minutes. Record each loop, HEAD and residual risks. Never merge the draft PR. Before a milestone full CI, check for existing same-SHA runs, and never represent earlier green CI as evidence for a newer commit.

Do not end merely because the first patch passed or an agent reported success. Continue to the next runnable issue while the session, tool access and usage budget permit. If session/tool context ends, checkpoint the next exact action in loop_state.json so resumption does not depend on chat screenshots. Do not falsely claim work will continue after the executing agent has stopped.

## D. Protected operations — ASK OWNER, then stop ONLY that gated operation

- Never merge into main or any release/production branch, or deploy to Cloudflare production.
- Never modify live user data, remote staging or production database schema, auth, seed, or migration ledger, even when credentials exist, without explicit target-specific owner approval.
- Never submit new App Store/TestFlight builds, change live store metadata, turn on JP market writes/region availability, enable paid payments or billing, purchase services, or spend paid API budget without authorization.
- Do not change or invalidate the PAN and DAN builds submitted to App Store on 2026-10-08. Submission does not prove release approval.
- No exposure of service-role keys, raw coordinates, passwords, env files, or personal data in state JSON, commits, agent logs, or PRs.
- Never conceal failures, disable tests to pass, fake review invocations, claim simulated iPhone testing as real, or mark guessed performance as measured.

For blockers: record an owner-facing one-line action (e.g., supply staging credentials through approved secret storage + approve staging-only SQL apply), skip to next safe development task, and continue. Human approval is only needed for protected operations and external account/billing/access setup, not routine bug fixes.

## E. Exit and reporting

**VERIFIED** only when review was actually invoked on the current exact HEAD and tests passed with captured evidence. **REVIEW_BLOCKED** if independent execution is unavailable. **READY_FOR_RELEASE** must NEVER be inferred from a clean development review; requires separate staging security, real iOS, legal, billing, launch and owner gates.

Maintain docs/dan-autonomous/loop_state.json after every cycle; do not erase historical cycles. Do not mark CI PASS merely because a draft PR's runner jobs were skipped. Use docs/dan-autonomous/CI_COST_POLICY.md for tiered test cadence and full-CI gates. Run node scripts/validate-dan-loop-state.mjs before every commit where the state changed.

At each durable checkpoint, report succinctly:
BRANCH, HEAD SHA, base/PR, tasks done, exact test commands + results, independent reviewer invoked/tool/evidence or BLOCKED, changed files, new cycle ID, security and migration risks, blocked approvals, next executable task. No repeated screenshot requests for ordinary work.

## F. If actual unattended orchestration is desired

This runbook + Cursor custom subagent can orchestrate within an active Cursor agent session; it is not yet an always-on Cursor↔Codex API controller. To run agents through restarts, implement and verify an explicit external controller against Cursor Cloud Agents API / SDK (run create/status/follow-up), independent reviewer invocation, polling, scoped credentials and cost limits. Do not treat this document, a JSON state file, or a scheduled notification as proof such a controller is deployed.
