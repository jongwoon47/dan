# DAN cost-aware CI and autonomous review policy (2026-10-10)

**Inspired by PAN 0.1.3:** implement and test iteratively in Cursor, use a separate readonly reviewer, checkpoint state locally, dispatch expensive GitHub Actions **only when there is a testable stable milestone**, and require fresh full gates before release.

## Observed waste (automation branch, 2026-10-10)

Before draft-gating, most `pull_request` synchronizes launched full `verify`+`supabase`+`visual` (~5.5 min). `cancel-in-progress: true` then cancelled prior runs when the next commit landed, discarding multi-minute Docker/E2E work. After draft-skip, draft PR jobs conclude `skipped` (no minutes). This revision also stops cancelling in-flight runs and keeps heavy suites off ordinary ready-PR pushes.

## Actual GitHub Actions behavior

Workflow: `.github/workflows/ci.yml` (validate with `npm run validate:ci-policy`).

| Event | verify | Supabase + pgTAP + two-user E2E + browser | Visual Playwright |
|---|---|---|---|
| Pull request **draft** opened/synchronized/reopened/labeled | SKIPPED | SKIPPED | SKIPPED |
| Pull request changed to **ready for review** | RUN | RUN | RUN |
| Commit pushed to an already **ready** PR (non-`main` base) | RUN | SKIPPED | SKIPPED |
| Ready PR title contains `[ci-full]` or label `ci-checkpoint` | RUN | RUN | RUN |
| PR base **`main`** (non-draft) | RUN | RUN | RUN |
| `workflow_dispatch` `suite=checkpoint` | SKIPPED (ledger + CI policy validator) | SKIPPED | SKIPPED |
| `workflow_dispatch` `suite=verify` | RUN | SKIPPED | SKIPPED |
| `workflow_dispatch` `suite=full` | RUN | RUN | RUN |

Concurrency: `cancel-in-progress: false` so an in-flight heavy suite is not discarded by the next push/dispatch.

A skipped job is **neither PASS nor verified release evidence**. PRs must stay **draft** during ordinary autonomous implementation. Do not change release branch protections or required checks to hide failures. Converting a draft to ready is owner/release-review gated; do not do it just to run CI. Job names `verify` / `supabase` / `visual` remain stable.

## Tiered verification

**Every patch (local only):** run relevant unit tests and typecheck when TypeScript changed; a readonly independent reviewer checks a frozen implementation SHA, and ledger validator runs before commit. Do not run `npm ci` repeatedly if lockfile is unchanged and node_modules are already valid. A build / lint / broader test run is warranted if the change touches bundling, build config, shared domain APIs or i18n coverage.

**Checkpoint after a coherent unit of work, not every commit:** run `npm run typecheck && npm run lint && npm test && npm run build` in agent environment. Use `suite=verify` manually only if a remote check is needed or local evidence cannot be trusted.

**Full CI checkpoint:** dispatch `suite=full` (or `bash scripts/dan-ci-checkpoint.sh full`) for security, RLS, Supabase migration, auth, payments, KR/JP writes, location privacy, full four-type trade lifecycle or browser/UI suite changes **after a coherent stable batch**. Also dispatch once after completing a multi-patch feature area or at the pre-release handoff. Do not dispatch again while a run on the **same commit** is already queued/running; the checkpoint script checks first. If a legitimate full test fails, inspect its log and fix root cause; run again on fixed SHA. Never suppress a test just to save minutes.

**Before any integration/release approval:** a FULL run (verify+supabase+visual) must PASS on the **exact final HEAD** under consideration. Local test PASS or reviewer PASS on an earlier SHA cannot substitute. The draft branch may remain unmergeable until ready-stage checks and separate human review. Remote DB, iOS device, legal and storefront gates remain separate.

## Manual invocation (from a connected Cursor environment)

```bash
# Check existing runs for this branch/SHA first; no duplicate if already running.
gh run list --workflow ci.yml --branch automation/dan-autonomous-review-loop-20261010 --limit 10

# Helper (skips dispatch when same SHA is already queued/in progress):
bash scripts/dan-ci-checkpoint.sh checkpoint   # ledger + CI policy only
bash scripts/dan-ci-checkpoint.sh verify
bash scripts/dan-ci-checkpoint.sh full

# Equivalent raw dispatches:
gh workflow run ci.yml --ref automation/dan-autonomous-review-loop-20261010 -f suite=checkpoint
gh workflow run ci.yml --ref automation/dan-autonomous-review-loop-20261010 -f suite=verify
gh workflow run ci.yml --ref automation/dan-autonomous-review-loop-20261010 -f suite=full
```

The `workflow_dispatch` option may require the latest workflow definition to be discoverable in the connected GitHub environment. If dispatch is unavailable, record **CI_DISPATCH_BLOCKED**, do not modify `main` just to make dispatch work, and keep `NOT_RUN` for that SHA. Manual full CI may also be triggered by changing a PR to ready at an explicitly approved review checkpoint, but never just to work around an Actions error.

## Agent handoff requirements

1. Continue the next safe issue from `loop_state.json`; do not pause for repetitive approval requests or screenshots.
2. Record for each patch: targeted local test commands/results, actual independent reviewer ID and exact SHA, unresolved findings, and next action.
3. Record FULL CI only when it actually ran, with run URL, SHA, all three job outcomes, and test evidence. Maintain `last_full_ci_sha` separately if desired; older CI green does not apply automatically to newer HEAD.
4. If runner, billing, Docker, native devices, staging access or external services are blocked, mark BLOCKED. Continue unrelated safe work.
5. Never merge, deploy, apply remote migrations, flip JP write gate, submit App Store builds, or spend paid API budget without separate permission.

This policy intentionally reduces **unnecessary CI triggers**, not test coverage or release safety.
