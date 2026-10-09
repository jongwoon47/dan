import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PRODUCTION_CLOUDFLARE_PROJECT,
  PRODUCTION_SUPABASE_PROJECT_REFS,
  STAGING_CLOUDFLARE_PROJECT,
  STAGING_SUPABASE_PROJECT_REF,
} from "../src/release/environmentSeparation.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("Cloudflare workflow isolation", () => {
  it("publishes production only through the guarded production project", () => {
    const cloudflare = readFileSync(
      path.join(root, ".github/workflows/deploy-cloudflare.yml"),
      "utf8",
    );
    expect(cloudflare).toContain("deploy-production");
    expect(cloudflare).toContain(PRODUCTION_SUPABASE_PROJECT_REFS[0]!);
    expect(cloudflare).toContain(`--project-name=${PRODUCTION_CLOUDFLARE_PROJECT}`);
    expect(cloudflare).toContain("github.ref == 'refs/heads/main'");
    expect(cloudflare).not.toContain(STAGING_SUPABASE_PROJECT_REF);
    expect(cloudflare).not.toContain(`--project-name=${STAGING_CLOUDFLARE_PROJECT}`);

    const pages = readFileSync(
      path.join(root, ".github/workflows/deploy-pages.yml"),
      "utf8",
    );
    expect(pages).toContain("production Supabase project is not configured");
    expect(pages).not.toMatch(/branches:\s*\[\s*main\s*\]/);
    expect(pages).not.toContain(STAGING_SUPABASE_PROJECT_REF);
  });

  it("deploys staging only to the isolated Cloudflare project with staging secrets", () => {
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
    expect(yml).toContain("${{ secrets.DAN_STAGING_SUPABASE_PROJECT_REF }}");
    expect(yml).toContain("VITE_DAN_ENV: staging");
  });
});
