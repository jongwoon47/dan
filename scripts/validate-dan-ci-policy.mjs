#!/usr/bin/env node
// Static invariants for DAN CI cost policy. Does not call GitHub Actions.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ciPath = path.join(root, ".github/workflows/ci.yml");
const text = fs.readFileSync(ciPath, "utf8");

const errors = [];

function requireIncludes(snippet, label) {
  if (!text.includes(snippet)) errors.push(`missing ${label}: ${JSON.stringify(snippet)}`);
}

requireIncludes("name: CI", "workflow name");
requireIncludes("cancel-in-progress: false", "preserve in-flight suites");
requireIncludes("pull_request.draft == false", "draft PR skip");
requireIncludes("ready_for_review", "ready_for_review full trigger");
requireIncludes("suite == 'full'", "dispatch full suite");
requireIncludes("suite == 'checkpoint'", "dispatch ledger checkpoint");
requireIncludes("suite != 'checkpoint'", "verify excludes ledger-only");
requireIncludes("[ci-full]", "title checkpoint marker");
requireIncludes("ci-checkpoint", "label checkpoint marker");
requireIncludes("github.base_ref == 'main'", "main base always heavy");

for (const job of ["  checkpoint:", "  verify:", "  supabase:", "  visual:"]) {
  requireIncludes(job, `job ${job.trim()}`);
}

if (/cancel-in-progress:\s*true/.test(text)) {
  errors.push("cancel-in-progress must remain false");
}

// Ready-PR synchronize must not alone imply heavy suites.
if (/pull_request\.draft == false\)\s*$/m.test(text.split("supabase:")[1]?.split("visual:")[0] ?? "")) {
  // loose guard: supabase if-block should mention ready_for_review or suite == 'full'
  const supabaseBlock = text.split("supabase:")[1]?.split("visual:")[0] ?? "";
  if (!supabaseBlock.includes("ready_for_review") || !supabaseBlock.includes("suite == 'full'")) {
    errors.push("supabase job must gate on ready_for_review / suite=full, not bare non-draft");
  }
}

if (errors.length) {
  console.error("DAN CI policy validation FAILED:");
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log("DAN CI policy invariants: PASS");
