import { assertProductionDeployAllowed } from "../src/release/productionDeployGuard.ts";

const decision = assertProductionDeployAllowed(process.env);
if (!decision.ok) {
  console.error(decision.message);
  process.exit(decision.code);
}
console.log(decision.message);
