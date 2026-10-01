import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_CLOUDFLARE_PROJECT,
  STAGING_CLOUDFLARE_PROJECT,
} from "../src/release/environmentSeparation.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Cloudflare workflow isolation", () => {
  it("keeps the existing production workflow on project dan", () => {
    const yml = readFileSync(
      path.join(root, ".github/workflows/deploy-cloudflare.yml"),
      "utf8",
    );
    expect(yml).toContain(`--project-name=${PRODUCTION_CLOUDFLARE_PROJECT} `);
    expect(yml).not.toContain(`--project-name=${STAGING_CLOUDFLARE_PROJECT}`);
  });

  it("deploys staging only to dan-staging with staging secrets", () => {
    const yml = readFileSync(
      path.join(root, ".github/workflows/deploy-cloudflare-staging.yml"),
      "utf8",
    );
    expect(yml).toContain(`--project-name=${STAGING_CLOUDFLARE_PROJECT} `);
    expect(yml).toContain("workflow_dispatch");
    expect(yml).not.toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(yml).not.toMatch(/--project-name=dan(?:\s|$)/);
    expect(yml).not.toContain("${{ secrets.VITE_SUPABASE_URL }}");
    expect(yml).not.toContain("${{ secrets.VITE_SUPABASE_ANON_KEY }}");
    expect(yml).not.toContain("${{ secrets.CLOUDFLARE_API_TOKEN }}");
    expect(yml).not.toContain("${{ secrets.CLOUDFLARE_ACCOUNT_ID }}");
    expect(yml).toContain("${{ secrets.STAGING_VITE_SUPABASE_URL }}");
    expect(yml).toContain("${{ secrets.STAGING_VITE_SUPABASE_ANON_KEY }}");
    expect(yml).toContain("${{ secrets.STAGING_CLOUDFLARE_API_TOKEN }}");
    expect(yml).toContain("${{ secrets.STAGING_CLOUDFLARE_ACCOUNT_ID }}");
  });
});
