import { describe, expect, it } from "vitest";
import { jaPilotCopy } from "./useDanCopy";
import { ko } from "./ko";

const CRITICAL_TRADE_KEYS = [
  "tradeInProgress",
  "tradeConfirmTitle",
  "tradeConfirmBuy",
  "tradeConfirmBorrow",
  "tradeConfirmTask",
  "tradeConfirmService",
  "tradeConfirmAction",
  "tradeCompleteCta",
  "tradeCancelCta",
  "tradeDoneTitle",
  "chatPlaceholder",
  "chatSend",
  "chatEmpty",
  "report",
  "block",
  "chatBlockedSend",
  "matchStatusConnected",
  "activityMatchCompleted",
] as const;

describe("JA trade / safety copy coverage", () => {
  it("covers critical chat/trade keys without falling back to Korean", () => {
    for (const key of CRITICAL_TRADE_KEYS) {
      expect(ko[key], key).toBeTruthy();
      expect(jaPilotCopy[key], key).toBeTruthy();
      expect(jaPilotCopy[key]).not.toEqual(ko[key]);
    }
  });

  it("covers every ko copy key in jaPilotCopy", () => {
    const koKeys = Object.keys(ko) as (keyof typeof ko)[];
    const missing = koKeys.filter((key) => !jaPilotCopy[key]);
    expect(missing).toEqual([]);
    expect(Object.keys(jaPilotCopy).length).toBe(koKeys.length);
  });
});
