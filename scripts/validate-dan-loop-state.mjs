#!/usr/bin/env node
// Validate the integrity of DAN's human-readable agent execution ledger.
// This is a schema/invariant check, NOT evidence that any agent or test ran.
import fs from 'node:fs';
import path from 'node:path';

const filename = process.argv[2] ?? path.resolve('docs/dan-autonomous/loop_state.json');
const allowedTask = new Set(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'DEFERRED']);
const allowedResult = new Set(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);
const allowedReview = new Set(['NOT_INVOKED', 'REVIEW_BLOCKED', 'FINDINGS', 'PASS']);
const errors = [];
function ok(value, label) {
  if (!value) errors.push(label);
}
function nonempty(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
let state;
try {
  state = JSON.parse(fs.readFileSync(filename, 'utf8'));
} catch (error) {
  console.error('DAN loop state unreadable:', String(error));
  process.exit(1);
}
ok(state.schema_version === 'dan.autonomy.loop.v1', 'schema_version mismatch');
ok(state.repository === 'jongwoon47/dan', 'wrong repository');
ok(state.branch === 'automation/dan-autonomous-review-loop-20261010', 'wrong execution branch');
ok(Array.isArray(state.backlog) && state.backlog.length > 0, 'backlog missing');
ok(Array.isArray(state.cycles), 'cycles must be an array');
ok(Array.isArray(state.blockers), 'blockers must be an array');
ok(state.autonomy && typeof state.autonomy === 'object', 'autonomy missing');
ok(state.release && state.release.status === 'NOT_APPROVED', 'release must remain NOT_APPROVED');
const ids = new Set();
for (const [i, task] of (state.backlog ?? []).entries()) {
  ok(nonempty(task.id) && !ids.has(task.id), 'invalid or duplicate backlog id #' + i);
  ids.add(task.id);
  ok(allowedTask.has(task.status), 'invalid task status: ' + task.id);
  ok(Array.isArray(task.evidence), 'task evidence must be array: ' + task.id);
  if (task.status === 'DONE') ok(task.evidence.length > 0, 'DONE needs evidence: ' + task.id);
}
const seenCycles = new Set();
for (const [i, cycle] of (state.cycles ?? []).entries()) {
  const prefix = 'cycle #' + i + ': ';
  ok(nonempty(cycle.id) && !seenCycles.has(cycle.id), prefix + 'invalid or duplicate id');
  seenCycles.add(cycle.id);
  ok(ids.has(cycle.task_id), prefix + 'task_id not in backlog');
  ok(/^[a-f0-9]{40}$/.test(cycle.implementation_sha ?? ''), prefix + 'implementation_sha must be 40-hex');
  ok(Array.isArray(cycle.tests), prefix + 'tests missing');
  for (const test of (cycle.tests ?? [])) {
    ok(nonempty(test.command) && allowedResult.has(test.status), prefix + 'bad test record');
    if (test.status === 'PASS') ok(nonempty(test.evidence), prefix + 'PASS test needs evidence');
  }
  const review = cycle.review ?? {};
  ok(allowedReview.has(review.status), prefix + 'invalid review status');
  ok(Array.isArray(review.findings), prefix + 'review findings must be array');
  if (review.status === 'PASS' || review.status === 'FINDINGS') {
    ok(nonempty(review.reviewer_tool), prefix + 'reviewer identity missing');
    ok(nonempty(review.invocation_ref), prefix + 'real invocation proof missing');
    ok(review.reviewed_sha === cycle.implementation_sha, prefix + 'reviewed SHA differs from patch');
    ok(nonempty(review.evidence), prefix + 'review evidence missing');
  }
  if (review.status === 'PASS') {
    ok(review.findings.length === 0, prefix + 'PASS with unresolved findings');
  }
  if (review.status === 'FINDINGS') {
    ok(review.findings.length > 0, prefix + 'FINDINGS without details');
  }
}
if (state.autonomy?.review_verification === 'VERIFIED') {
  const last = state.cycles?.at(-1);
  ok(state.autonomy.independent_review_invoked === true, 'VERIFIED without separate reviewer invocation');
  ok(last?.review?.status === 'PASS', 'VERIFIED without latest reviewer PASS');
  ok(last?.review?.reviewed_sha === state.running_head, 'VERIFIED on stale HEAD');
  ok((last?.tests ?? []).some(t => t.status === 'PASS'), 'VERIFIED without positive test evidence');
}
if (state.phase === 'VERIFIED') {
  ok(state.autonomy?.review_verification === 'VERIFIED', 'phase VERIFIED without validated review');
}
if (state.autonomy?.independent_review_invoked === false) {
  ok(state.autonomy?.review_verification !== 'VERIFIED', 'uninvoked review cannot be VERIFIED');
}
if (errors.length) {
  console.error('DAN loop state validation FAILED:');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log('DAN loop state format/invariants: PASS (does not validate external evidence)');
