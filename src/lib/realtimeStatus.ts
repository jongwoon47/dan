export type RealtimeNotice = "live" | "recovering";

/** Demo chat never reports a channel status, so it stays quiet. */
export function realtimeNotice(status: string): RealtimeNotice | null {
  if (status === "SUBSCRIBED") return "live";
  if (
    status === "CHANNEL_ERROR" ||
    status === "TIMED_OUT" ||
    status === "CLOSED"
  ) {
    return "recovering";
  }
  return null;
}
