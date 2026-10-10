# Owner: Full CI unblock + staging / iOS gates (2026-10-10)

**PR:** #37 Draft — `automation/dan-autonomous-review-loop-20261010`  
**Tip SHA (docs ledger):** `5502cfade46dcdd7f3edb5b91edc528f0278eb29`  
**Latest reviewed code SHA:** `ff818d76294560998d659d5a845038f529397a69`  
**Do not:** merge to `main`, mark PR Ready just for CI, deploy production, apply remote DB, unlock JP writes, run paid APIs, or submit App Store/EAS without separate approval.

## A. Why `suite=full` returns HTTP 403

### A1. Primary (confirmed): Cursor integration token lacks Actions write

| Fact | Evidence |
|---|---|
| Auth identity | `gh auth status` → account `cursor`, token prefix `ghs_` (GitHub App installation token) |
| API error | `POST .../actions/workflows/368387807/dispatches` → **403** `Resource not accessible by integration` |
| Required permission | Response header `X-Accepted-Github-Permissions: actions=write` |
| Token capability | Workflow GET accepts `actions=read` only; dispatch needs **write** |
| History | No `workflow_dispatch` runs exist for `ci.yml` in this repo (empty event list) |

Agent command that fails (expected until permission granted):

```bash
bash scripts/dan-ci-checkpoint.sh full
# → gh workflow run ci.yml --ref automation/dan-autonomous-review-loop-20261010 -f suite=full
```

### A2. Secondary: `ci.yml` is not on default branch `main`

| Branch | `.github/workflows/ci.yml` |
|---|---|
| `main` | **Missing** (only `deploy-cloudflare.yml`, `deploy-pages.yml`) |
| PR #37 head / base (`cursor/dan-commercial-complete-e0e7`) | Present |
| GitHub workflow registry | CI id `368387807` still **active** (registered from feature/automation history) |

GitHub’s UI “Run workflow” for `workflow_dispatch` normally requires the workflow file on the **default branch**. Even after granting Actions write to the agent, the Actions UI may not expose Run workflow until `ci.yml` exists on `main`.

### A3. Not the cause

- Workflow file **does** define `on.workflow_dispatch` with `suite: full|verify|checkpoint` on the automation branch.
- Draft PR skip policy correctly skips `pull_request` jobs; that is intentional cost control, not the 403.
- Marking Ready would run full suites via `ready_for_review` — **forbidden** unless you explicitly approve Ready.

### A4. Local Full-CI substitute (agent VM)

| Step | Result |
|---|---|
| `npm test` / typecheck / build on tip | **PASS** (259 unit) |
| `supabase start` | **FAIL** `DbSetupError` — Realtime init container exits during schema init (B-004) |
| Therefore | Cannot replace GitHub `supabase`+E2E jobs in this VM |

---

## B. Owner actions to run Full CI once (keep Draft)

### Preferred path (no Ready, no production)

1. **Grant Actions write to the Cursor GitHub App** on `jongwoon47/dan`  
   - GitHub → Settings → Applications / Installed GitHub Apps → Cursor (or the app backing cloud agents) → Repository permissions → **Actions: Read and write** → Save.  
   - Confirm the agent can `gh api --method POST .../dispatches` without 403.

2. **Put `ci.yml` on `main` (requires your explicit approval to change `main`)**  
   - Minimal change: copy current `.github/workflows/ci.yml` (and only if needed `scripts/validate-dan-ci-policy.mjs` dependencies already on branch) onto `main` via a tiny owner-approved PR.  
   - Do **not** merge PR #37 for this; isolate workflow registration.

3. **Dispatch once on the automation tip** (your account or agent after step 1–2):

```bash
gh workflow run ci.yml \
  --ref automation/dan-autonomous-review-loop-20261010 \
  -f suite=full
# Verify jobs verify + supabase + visual all success on exact tip SHA
gh run list --workflow=ci.yml --branch automation/dan-autonomous-review-loop-20261010 --limit 3
```

4. **Or use Actions UI** (after `ci.yml` is on `main`):  
   Actions → **CI** → Run workflow → Branch `automation/dan-autonomous-review-loop-20261010` → suite **full** → Run.

### Acceptable alternative (only if you approve Ready temporarily)

- Mark PR #37 Ready for review → policy runs full `verify`+`supabase`+`visual` on `ready_for_review`.  
- Re-convert to Draft after the run if desired.  
- **Do not ask the agent to do this** unless you say so in a new message.

### Success criteria for Full CI

- Run URL recorded  
- `headSha` equals intended tip (`5502cfa` or newer code tip if you add commits)  
- Jobs: `verify` PASS, `supabase` PASS, `visual` PASS  
- Update `docs/dan-autonomous/loop_state.json` → `last_full_ci_sha`, `latest_tests.ci=PASS`

---

## C. After Full CI green — Staging checklist (approval-gated)

**Status now:** B-001 BLOCKED (no staging credentials; apply not approved).  
**Docs:** `docs/STAGING_MIGRATION_APPLY_PLAN_20261009.md`, `docs/STAGING_DRIFT_RECONCILIATION_20261009.md`

| # | Step | Who | Notes |
|---|---|---|---|
| S1 | Provide staging project access (`STAGING_SUPABASE_DB_URL` / service role via approved secret store) | Owner | Never paste into PR/chat |
| S2 | Read-only ledger probe vs repo migrations tip through `20261010040000` | Agent/Owner | Diff only; no apply |
| S3 | Approve **staging-only** forward SQL apply for missing versions | Owner | Explicit message naming staging project |
| S4 | Apply missing migrations in order; record applied versions | Owner or approved agent | No production |
| S5 | Smoke: consent, KR BUY create→offer→payment gate honesty, report/block, JP create still locked | Agent/Owner | Staging data only |
| S6 | Nearby/region/route privacy: deny GPS, approximate labels, no precise public coords | Agent/Owner | |
| S7 | Decide JP write unlock separately (legal/APPI) — default **stay locked** | Owner | |

---

## D. After Full CI green — iOS / TestFlight checklist (approval-gated)

**Status now:** B-002 BLOCKED (no Mac/device in agent VM).  
**Workflows present (do not run without approval):** `ios-staging-build.yml`, `ios-staging-signed.yml`, `ios-staging-testflight.yml`

| # | Step | Who | Notes |
|---|---|---|---|
| I1 | Approve staging iOS build (EAS/local Xcode) for **staging** only | Owner | No App Store submit |
| I2 | Install on real iPhone; capture device model + iOS version | Owner | Browser/emulation ≠ device |
| I3 | KO + JA: login/consent, create BUY, offer path, chat, report/block, offline | Owner | |
| I4 | Location: permission deny + approximate nearby; no precise leak in UI | Owner | |
| I5 | Confirm JP create/trade still gated on device | Owner | |
| I6 | Optional TestFlight internal only after I1–I5 | Owner | Separate approval from production |

---

## E. Agent resume instruction

When Full CI is green on tip, set `latest_tests.ci=PASS`, `last_full_ci_sha=<exact sha>`, clear B-005 to MITIGATED/DONE with run URL, then wait for owner staging/iOS approvals. Do not merge, deploy, or unlock JP.
