import { describe, expect, it } from "vitest";
import { realtimeNotice } from "./realtimeStatus";

describe("realtimeNotice", () => {
  it("stays quiet before a channel reports", () => {
    expect(realtimeNotice("")).toBeNull();
  });

  it("marks a subscribed channel as live", () => {
    expect(realtimeNotice("SUBSCRIBED")).toBe("live");
  });

  it("asks the user to wait for automatic recovery after a drop", () => {
    expect(realtimeNotice("CHANNEL_ERROR")).toBe("recovering");
    expect(realtimeNotice("TIMED_OUT")).toBe("recovering");
    expect(realtimeNotice("CLOSED")).toBe("recovering");
  });
});
