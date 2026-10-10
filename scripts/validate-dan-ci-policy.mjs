#!/usr/bin/env node
// Static invariants for DAN CI cost policy. Does not call GitHub Actions.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ciPath = path.join(root, ".github/workflows/ci.yml");
const text = fs.readFileSync(ciPath, "utf8");
const lines = text.split(/\r?\n/);

const errors = [];
const JOB_KEYS = new Set(["checkpoint", "verify", "supabase", "visual"]);

function requireIncludes(snippet, label) {
  if (!text.includes(snippet)) errors.push(`missing ${label}: ${JSON.stringify(snippet)}`);
}

/** Collect top-level job blocks under jobs: (exactly two-space keys). */
function parseJobs() {
  const jobs = {};
  let current = null;
  let inJobs = false;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^[a-zA-Z]/.test(line)) break; // next top-level key
    const jobMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (jobMatch) {
      current = jobMatch[1];
      jobs[current] = [];
      continue;
    }
    if (current) jobs[current].push(line);
  }
  return jobs;
}

function jobIf(jobLines) {
  for (const line of jobLines) {
    const m = line.match(/^\s+if:\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return "";
}

requireIncludes("name: CI", "workflow name");
requireIncludes("cancel-in-progress: false", "preserve in-flight suites");
requireIncludes("ready_for_review", "ready_for_review full trigger");
requireIncludes("suite == 'full'", "dispatch full suite");
requireIncludes("suite == 'checkpoint'", "dispatch ledger checkpoint");
requireIncludes("suite != 'checkpoint'", "verify excludes ledger-only");
requireIncludes("[ci-full]", "title checkpoint marker");
requireIncludes("ci-checkpoint", "label checkpoint marker");
requireIncludes("github.base_ref == 'main'", "main base always heavy");

if (/cancel-in-progress:\s*true/.test(text)) {
  errors.push("cancel-in-progress must remain false");
}

const jobs = parseJobs();
for (const name of JOB_KEYS) {
  if (!jobs[name]) errors.push(`missing job ${name}`);
}

const verifyIf = jobIf(jobs.verify || []);
const supabaseIf = jobIf(jobs.supabase || []);
const visualIf = jobIf(jobs.visual || []);

if (!verifyIf.includes("draft == false")) {
  errors.push("verify must skip draft PRs");
}

for (const [name, expr] of [
  ["supabase", supabaseIf],
  ["visual", visualIf],
]) {
  if (!expr) {
    errors.push(`${name} must declare if: conditions`);
    continue;
  }
  if (!expr.includes("suite == 'full'")) {
    errors.push(`${name} must require workflow_dispatch suite=full as a heavy path`);
  }
  if (!expr.includes("ready_for_review")) {
    errors.push(`${name} must allow ready_for_review as a heavy path`);
  }
  if (!expr.includes("draft == false")) {
    errors.push(`${name} must skip draft PRs`);
  }
  if (!expr.includes("base_ref == 'main'")) {
    errors.push(`${name} must keep main-base heavy path`);
  }
  if (!expr.includes("[ci-full]") || !expr.includes("ci-checkpoint")) {
    errors.push(`${name} must keep [ci-full] and ci-checkpoint opt-in markers`);
  }
  // Bare non-draft alone must not enable heavy suites.
  const compact = expr.replace(/\s+/g, "");
  if (
    compact.includes("pull_request.draft==false)}") ||
    /draft==false\)\}\}"?$/.test(compact) ||
    /draft==false\)\}$/.test(compact)
  ) {
    // Allow only when further AND conditions follow draft==false
    if (!compact.includes("draft==false&&(")) {
      errors.push(`${name} must not enable heavy suite on bare non-draft alone`);
    }
  }
}

const header = text.slice(0, text.indexOf("\non:"));
for (const marker of ["ready_for_review", "main", "[ci-full]", "ci-checkpoint", "suite=full"]) {
  if (!header.includes(marker)) {
    errors.push(`workflow header comment must mention ${marker}`);
  }
}

if (errors.length) {
  console.error("DAN CI policy validation FAILED:");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log("DAN CI policy invariants: PASS");
