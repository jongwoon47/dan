import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function isoHoursAgo(hours: number): string {
  return new Date(NOW - hours * 3_600_000).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(NOW - days * 86_400_000).toISOString();
}

describe("formatRelativeTime", () => {
  it("returns Korean phrases by default", () => {
    expect(formatRelativeTime(isoMinutesAgo(0.2), "ko", NOW)).toBe("방금");
    expect(formatRelativeTime(isoMinutesAgo(5), "ko", NOW)).toBe("5분 전");
    expect(formatRelativeTime(isoHoursAgo(3), "ko", NOW)).toBe("3시간 전");
  });

  it("returns Japanese phrases when language is ja", () => {
    expect(formatRelativeTime(isoMinutesAgo(0.2), "ja", NOW)).toBe("たった今");
    expect(formatRelativeTime(isoMinutesAgo(5), "ja", NOW)).toBe("5分前");
    expect(formatRelativeTime(isoHoursAgo(3), "ja", NOW)).toBe("3時間前");
    expect(formatRelativeTime(isoDaysAgo(3), "ja", NOW)).toBe("3日前");
  });

  it("localizes yesterday", () => {
    const nowLocal = new Date();
    nowLocal.setHours(15, 0, 0, 0);
    const yesterdayLocal = new Date(nowLocal);
    yesterdayLocal.setDate(yesterdayLocal.getDate() - 1);
    yesterdayLocal.setHours(12, 0, 0, 0);
    const iso = yesterdayLocal.toISOString();
    const nowMs = nowLocal.getTime();
    expect(formatRelativeTime(iso, "ko", nowMs)).toBe("어제");
    expect(formatRelativeTime(iso, "ja", nowMs)).toBe("昨日");
  });

  it("returns empty string for invalid input", () => {
    expect(formatRelativeTime("not-a-date", "ja", NOW)).toBe("");
  });
});
