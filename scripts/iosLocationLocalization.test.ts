import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iOS location permission localization", () => {
  const project = readFileSync("ios/App/App.xcodeproj/project.pbxproj", "utf8");
  const plist = readFileSync("ios/App/App/Info.plist", "utf8");

  it("ships a foreground-only location purpose string", () => {
    expect(plist).toContain("<key>NSLocationWhenInUseUsageDescription</key>");
    expect(plist).not.toContain("<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>");
  });

  it("bundles Korean and Japanese purpose strings as localized resources", () => {
    for (const lang of ["ko", "ja"]) {
      const strings = readFileSync(`ios/App/App/${lang}.lproj/InfoPlist.strings`, "utf8");
      expect(strings).toContain('"NSLocationWhenInUseUsageDescription"');
      expect(project).toContain(`${lang}.lproj/InfoPlist.strings`);
    }
    expect(project).toContain("InfoPlist.strings in Resources");
  });
});
