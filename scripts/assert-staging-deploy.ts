import { assertStagingDeployAllowed } from "../src/release/stagingDeployGuard.ts";

const decision = assertStagingDeployAllowed(process.env);
if (!decision.ok) {
  console.error(decision.message);
  process.exit(decision.code);
}

console.log(decision.message);
