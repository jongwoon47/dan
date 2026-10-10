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

## Evidence and test cadence: targeted → checkpoint → full

Read `docs/dan-autonomous/CI_COST_POLICY.md`. Full GitHub Actions on every draft commit is **not required** and is discouraged.

1. **Patch cycle:** relevant local unit/component or DB tests and readonly independent review on a frozen SHA; no remote full CI automatically.
2. **Feature checkpoint:** local npm typecheck/lint/unit/build as relevant; optional manually dispatched `verify` GitHub Actions suite.
3. **Risk checkpoint:** isolated Supabase migrations and pgTAP, local real two-user E2E/browser smoke and visual Playwright when applicable. If no local Docker, use manually dispatched `full` GitHub Actions on a stable milestone and preserve the link. Security, migrations, RLS, auth, payments and release validation MUST obtain the full evidence before completion claims.
4. **Staging:** read-only migration ledger probes only absent separate owner approval for any write.
5. **iOS/TestFlight:** actual device evidence only, never inferred from browser tests.
6. **Release:** GitHub Actions `verify`, `supabase`, and `visual` must all PASS against the **exact proposed final HEAD**. An older CI PASS or a skipped DRAFT check is NOT_RUN/STALE, not PASS for that HEAD.

Review PASS is limited to the code scope inspected. It does not supersede mandatory future full checks. If tests fail, fix rather than skip. Report tools unavailable as BLOCKED; ensure no fabricated evidence.

## Resume and stopping

Continue to highest priority runnable task, not a routine approval request. Stop a protected action at its gate and proceed with safe tasks. If all remaining work is truly external or the session ends, preserve the current HEAD, exact blockers, next_action, and a truthful last_report.

Only the repository owner can authorize release/merge/remote DB changes. Never set release approval or Japan write activation from this loop alone.
