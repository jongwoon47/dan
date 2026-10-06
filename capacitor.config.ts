import type { CapacitorConfig } from "@capacitor/cli";

// This checkout has no approved production backend. Never create a release
// binary by silently packaging its staging bundle as production.
if (process.env.DAN_IOS_ENV !== "staging") {
  throw new Error("iOS preparation requires DAN_IOS_ENV=staging. Production packaging is disabled.");
}

const config: CapacitorConfig = {
  appId: "app.dan.staging",
  appName: "DAN Staging",
  webDir: "dist",
  ios: { contentInset: "never", backgroundColor: "#ffffff" },
};
export default config;
