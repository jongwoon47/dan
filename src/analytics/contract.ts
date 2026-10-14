export const ANALYTICS_EVENTS = [
  "landing_view",
  "signup_completed",
  "login_completed",
  "discovery_view",
  "discovery_search",
  "demand_create_started",
  "demand_created",
  "demand_shared",
  "quick_offer_started",
  "quick_offer_created",
  "offer_viewed",
  "interest_created",
  "match_connected",
  "chat_message_sent",
  "seller_evidence_submitted",
  "deal_snapshot_locked",
  "payment_gate_viewed",
  "handoff_started",
  "trade_completed",
  "trade_canceled",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const ANALYTICS_PROP_KEYS = [
  "product_category",
  "product_id",
  "demand_id",
  "match_id",
  "source",
  "fulfillment_type",
] as const;

export type AnalyticsPropKey = (typeof ANALYTICS_PROP_KEYS)[number];
export type AnalyticsProps = Partial<Record<AnalyticsPropKey, string>>;

const ALLOWED = new Set<string>(ANALYTICS_PROP_KEYS);
const MAX_PROP_LENGTH = 80;

export function isAnalyticsEventName(value: string): value is AnalyticsEventName {
  return (ANALYTICS_EVENTS as readonly string[]).includes(value);
}

/** Drop anything that is not a short funnel id. Chat text and contact data never pass. */
export function sanitizeAnalyticsProps(input: unknown): AnalyticsProps {
  if (!input || typeof input !== "object") return {};
  const out: AnalyticsProps = {};
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED.has(key)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_PROP_LENGTH) continue;
    if (trimmed.includes("@") || /\s/.test(trimmed)) continue;
    out[key as AnalyticsPropKey] = trimmed;
  }
  return out;
}

export interface AnalyticsProvider {
  track(name: AnalyticsEventName, props: AnalyticsProps): void;
}

export class NoopAnalyticsProvider implements AnalyticsProvider {
  track(): void {}
}

let provider: AnalyticsProvider = new NoopAnalyticsProvider();

export function configureAnalytics(next: AnalyticsProvider): void {
  provider = next;
}

export function resetAnalyticsForTests(): void {
  provider = new NoopAnalyticsProvider();
}

export function track(name: AnalyticsEventName, props?: unknown): void {
  provider.track(name, sanitizeAnalyticsProps(props));
}
