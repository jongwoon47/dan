import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = process.env.DAN_IOS_ENV?.trim();
if (target !== "staging" && target !== "production") {
  throw new Error("DAN_IOS_ENV must be staging or production.");
}

const production = target === "production";
const bundleId = production
  ? process.env.DAN_IOS_BUNDLE_ID?.trim()
  : "app.dan.staging";
if (!bundleId) throw new Error("DAN_IOS_BUNDLE_ID is required for production.");

const appName = production ? "DAN" : "DAN Staging";
const authScheme = production ? "dan" : "dan-staging";

const plistPath = "ios/App/App/Info.plist";
const projectPath = "ios/App/App.xcodeproj/project.pbxproj";
if (!existsSync(plistPath) || !existsSync(projectPath)) {
  throw new Error("Capacitor iOS project is missing.");
}

let plist = readFileSync(plistPath, "utf8");
plist = plist
  .replace(
    /(<key>CFBundleURLName<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${bundleId}.auth$2`,
  )
  .replace(
    /(<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>)[^<]*(<\/string>\s*<\/array>)/,
    `$1${authScheme}$2`,
  )
  .replace(
    /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
    `$1${appName}$2`,
  );
writeFileSync(plistPath, plist);

let project = readFileSync(projectPath, "utf8");
project = project.replace(
  /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
  `PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`,
);
writeFileSync(projectPath, project);

const swiftPath = "ios/App/CapApp-SPM/Package.swift";
if (existsSync(swiftPath)) {
  const swift = readFileSync(swiftPath, "utf8");
  writeFileSync(
    swiftPath,
    swift.replace(
      /(path:\s*")([^"]+)(")/g,
      (_, start, value, end) => start + value.replace(/\\/g, "/") + end,
    ),
  );
}

console.log(
  `Configured iOS target: ${target} · ${bundleId} · ${authScheme}://auth/callback`,
);
