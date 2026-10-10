# DAN independent review and state protocol

## Ground rules

- The implementer must call a **separate readonly dan-independent-reviewer subagent** through Cursor's actual agent delegation. A text-only claim that another agent reviewed the patch is invalid.
- Cursor supports project subagents under .cursor/agents. The invocation should be traceable by a task card, run ID or saved transcript reference. Codex CLI/cloud can be used as an additional independent reviewer only if actually executed.
- Every review targets an **exact commit SHA** and its diff. Fixes alter HEAD and require another review on the new SHA.
- A reviewer may return PASS only for reviewed code scope. A PASS is **not** CI PASS, iOS-device PASS, staging DB approval, App Store approval, or commercial release sign-off.
- If subagent/runner cannot execute, store REVIEW_BLOCKED and the missing capability (e.g., model delegation, CLI installation, cloud permission, insufficient API balance), then work on other safe tasks. Never fabricate invocation evidence.
- Keep state JSON free of credentials, personal data, exact GPS coordinates and raw unredacted logs.

## State updates

File: docs/dan-autonomous/loop_state.json; validate using node scripts/validate-dan-loop-state.mjs.

For each completed implementation cycle append a distinct cycles[] object:

- id: C001, C002, ...
- task_id: one of the backlog IDs
- implementation_sha: exact patch commit that was tested
- tests: array of {command, status, evidence} where status is PASS, FAIL, BLOCKED or NOT_RUN
- review: {status, reviewer_tool, invocation_ref, reviewed_sha, findings, evidence}
  - status must be NOT_INVOKED, REVIEW_BLOCKED, FINDINGS or PASS
  - PASS requires reviewer_tool, invocation_ref, reviewed_sha equal to implementation_sha, and evidence
  - FINDINGS must preserve severity, file, line or symbol, reproduction, expected fix
- next_action: specific and executable, or an explicit external owner dependency

Set autonomy.independent_review_invoked true only after a genuine call. Set autonomy.review_verification VERIFIED only when the latest cycle is PASS for the exact current running_head and required tests for that scoped change passed. Otherwise use UNVERIFIED or REVIEW_BLOCKED.

Update backlog entries with status (TODO, IN_PROGRESS, DONE, BLOCKED or DEFERRED), evidence, and blockers. DONE needs real evidence. Never mark blocked/deferred as done simply to inflate completion.

## Minimum testing matrix per relevant patch

1. npm run typecheck, npm run lint, npm test, npm run build.
2. supabase start, supabase db reset, supabase test db (local only).
3. npm run test:e2e:local and Playwright Supabase browser smoke on isolated local test users.
4. npx playwright test e2e/visual --config=playwright.visual.config.ts.
5. Staging DB ledger and app flow: read-only verification only unless owner explicitly authorizes writes; otherwise BLOCKED.
6. Real iOS/TestFlight device verification: BLOCKED unless actually performed on supported device/build.
7. Current GitHub Actions checks: use same HEAD SHA and disclose whether GitHub billing or workflows prevent execution.

Test failures must be fixed, not hidden. Unsupported environment should be recorded as BLOCKED, not PASS.

## Resume and stopping

Continue to highest priority runnable task, not a routine approval request. Stop a protected action at its gate and proceed with safe tasks. If all remaining work is truly external or the session ends, preserve the current HEAD, exact blockers, next_action, and a truthful last_report.

Only the repository owner can authorize release/merge/remote DB changes. Never set release approval or Japan write activation from this loop alone.
