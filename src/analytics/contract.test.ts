import { describe, expect, it } from "vitest";
import {
  ANALYTICS_EVENTS,
  configureAnalytics,
  resetAnalyticsForTests,
  sanitizeAnalyticsProps,
  track,
  type AnalyticsEventName,
  type AnalyticsProps,
  type AnalyticsProvider,
} from "./contract";

describe("analytics contract", () => {
  it("keeps the V1 funnel event names", () => {
    expect(ANALYTICS_EVENTS).toContain("demand_created");
    expect(ANALYTICS_EVENTS).toContain("trade_completed");
    expect(ANALYTICS_EVENTS).toHaveLength(20);
  });

  it("keeps only short funnel ids", () => {
    expect(
      sanitizeAnalyticsProps({
        product_category: "camera",
        demand_id: "d1",
        email: "a@b.co",
        message: "meet at the station",
        display_name: "민아",
        body: "serial number talk",
      }),
    ).toEqual({
      product_category: "camera",
      demand_id: "d1",
    });
  });

  it("drops chat text hidden inside an allowed key", () => {
    expect(
      sanitizeAnalyticsProps({
        source: "user typed a private note",
        match_id: "m-1",
      }),
    ).toEqual({ match_id: "m-1" });
  });

  it("sends a sanitized event to a provider", () => {
    const seen: Array<{ name: AnalyticsEventName; props: AnalyticsProps }> = [];
    const sink: AnalyticsProvider = {
      track(name, props) {
        seen.push({ name, props });
      },
    };
    configureAnalytics(sink);
    track("demand_created", {
      product_id: "prod-1",
      note: "do not send",
    });
    expect(seen).toEqual([
      { name: "demand_created", props: { product_id: "prod-1" } },
    ]);
    resetAnalyticsForTests();
  });
});
