import type { CapacitorConfig } from "@capacitor/cli";

const target = process.env.DAN_IOS_ENV?.trim();
if (target !== "staging" && target !== "production") {
  throw new Error("iOS preparation requires DAN_IOS_ENV=staging or DAN_IOS_ENV=production.");
}

const production = target === "production";
const productionBundleId = process.env.DAN_IOS_BUNDLE_ID?.trim() ?? "";
if (production && !productionBundleId) {
  throw new Error("Production iOS preparation requires DAN_IOS_BUNDLE_ID.");
}

const config: CapacitorConfig = {
  appId: production ? productionBundleId : "app.dan.staging",
  appName: production ? "DAN" : "DAN Staging",
  webDir: "dist",
  ios: { contentInset: "never", backgroundColor: "#ffffff" },
};
export default config;
