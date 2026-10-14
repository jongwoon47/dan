import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertStagingSeedAllowed } from "../src/release/stagingSeedGuard.ts";

const decision = assertStagingSeedAllowed(process.env);
if (!decision.ok) {
  console.error(decision.message);
  process.exit(decision.code);
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sqlPath = path.join(root, "supabase", "seeds", "staging_live_demands.sql");
const dbUrl = process.env.SUPABASE_DB_URL ?? "";

const result = spawnSync(
  "psql",
  [
    dbUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "select set_config('dan.seed_target','staging', false)",
    "-f",
    sqlPath,
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(
    "NEEDS USER: psql is not available on this machine, so the staging seed did not run.",
  );
  process.exit(2);
}

process.exit(result.status ?? 1);
