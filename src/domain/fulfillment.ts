import { ko } from "@/copy/ko";

/** Public approximate place — never exact private address in V1. */
export type Place = {
  publicLabel: string;
  regionCode?: string;
  region1?: string;
  region2?: string;
  region3?: string;
  geo?: {
    lat: number;
    lng: number;
  };
};

export type FulfillmentMode =
  | "REMOTE"
  | "SHIPPING"
  | "MEETUP"
  | "ONSITE"
  | "PICKUP"
  | "ROUTE";

export type FulfillmentOption =
  | { mode: "REMOTE" }
  | { mode: "SHIPPING" }
  | { mode: "MEETUP"; place: Place }
  | { mode: "ONSITE"; place: Place }
  | { mode: "PICKUP"; place: Place }
  | { mode: "ROUTE"; from: Place; to: Place };

export type FeedAreaFilter = "all" | "nearby" | "online";

export function place(publicLabel: string, partial: Omit<Partial<Place>, "publicLabel"> = {}): Place {
  return {
    ...partial,
    publicLabel: publicLabel.trim(),
  };
}

export function isPlaceValid(p: Place | undefined | null): p is Place {
  return Boolean(p && p.publicLabel.trim().length > 0);
}

export function isFulfillmentOptionValid(option: FulfillmentOption): boolean {
  switch (option.mode) {
    case "REMOTE":
    case "SHIPPING":
      return true;
    case "MEETUP":
    case "ONSITE":
    case "PICKUP":
      return isPlaceValid(option.place);
    case "ROUTE":
      return isPlaceValid(option.from) && isPlaceValid(option.to);
    default:
      return false;
  }
}

export function areFulfillmentOptionsValid(
  options: FulfillmentOption[] | undefined | null,
): boolean {
  if (!options || options.length === 0) return false;
  return options.every(isFulfillmentOptionValid);
}

/** Derive legacy BUY tradeMethod from fulfillment options. */
export function tradeMethodFromFulfillment(
  options: FulfillmentOption[],
): "meetup" | "shipping" | "any" {
  const shipping = options.some((o) => o.mode === "SHIPPING");
  const meetup = options.some((o) => o.mode === "MEETUP");
  if (shipping && meetup) return "any";
  if (shipping) return "shipping";
  if (meetup) return "meetup";
  return "any";
}

export function formatPlace(p: Place): string {
  return p.publicLabel.trim();
}

/** First place-bearing option for detail/location rows (coords never included). */
export function primaryPublicPlace(options: FulfillmentOption[]): Place | null {
  for (const o of options) {
    if (o.mode === "MEETUP" || o.mode === "ONSITE" || o.mode === "PICKUP") {
      return o.place;
    }
    if (o.mode === "ROUTE") return o.from;
  }
  return null;
}

/** Mode-only labels for detail “진행 방식” (place shown separately). */
export function formatFulfillmentModes(options: FulfillmentOption[]): string {
  if (!options.length) return "";
  return options
    .map((option) => {
      switch (option.mode) {
        case "REMOTE":
          return ko.fulfillRemote;
        case "SHIPPING":
          return ko.fulfillShipping;
        case "MEETUP":
          return ko.fulfillMeetup;
        case "ONSITE":
          return ko.fulfillOnsite;
        case "PICKUP":
          return ko.fulfillPickup;
        case "ROUTE":
          return `${formatPlace(option.from)} → ${formatPlace(option.to)}`;
      }
    })
    .join(" · ");
}

export function formatFulfillmentOption(option: FulfillmentOption): string {
  switch (option.mode) {
    case "REMOTE":
      return ko.fulfillRemote;
    case "SHIPPING":
      return ko.fulfillShipping;
    case "MEETUP":
      return `${ko.fulfillMeetup} · ${formatPlace(option.place)}`;
    case "ONSITE":
      return `${ko.fulfillOnsite} · ${formatPlace(option.place)}`;
    case "PICKUP":
      return `${ko.fulfillPickup} · ${formatPlace(option.place)}`;
    case "ROUTE":
      return `${formatPlace(option.from)} → ${formatPlace(option.to)}`;
  }
}

export function formatFulfillmentSummary(options: FulfillmentOption[]): string {
  if (!options.length) return "";
  return options.map(formatFulfillmentOption).join(" · ");
}

/** Short card line (no verbose labels). */
export function formatFulfillmentCardLine(options: FulfillmentOption[]): string {
  return options
    .map((option) => {
      switch (option.mode) {
        case "REMOTE":
          return ko.fulfillRemote;
        case "SHIPPING":
          return ko.fulfillShippingShort;
        case "MEETUP":
          return `${formatPlace(option.place)} ${ko.fulfillMeetup}`;
        case "ONSITE":
          return formatPlace(option.place);
        case "PICKUP":
          return formatPlace(option.place);
        case "ROUTE":
          return `${formatPlace(option.from)} → ${formatPlace(option.to)}`;
      }
    })
    .join(" · ");
}

export function summarizeBuyFulfillment(optionsList: FulfillmentOption[][]): string {
  let shipping = false;
  let meetup = false;
  for (const options of optionsList) {
    for (const o of options) {
      if (o.mode === "SHIPPING") shipping = true;
      if (o.mode === "MEETUP") meetup = true;
    }
  }
  const parts: string[] = [];
  if (shipping) parts.push(ko.fulfillShippingShort);
  if (meetup) parts.push(ko.fulfillMeetupDemand);
  return parts.join(" · ") || ko.fulfillShippingShort;
}

export function hasRemoteOption(options: FulfillmentOption[]): boolean {
  return options.some((o) => o.mode === "REMOTE");
}

export function hasShippingOption(options: FulfillmentOption[]): boolean {
  return options.some((o) => o.mode === "SHIPPING");
}

export function collectRegion2Keys(options: FulfillmentOption[]): string[] {
  const keys = new Set<string>();
  for (const o of options) {
    if (o.mode === "REMOTE" || o.mode === "SHIPPING") continue;
    if (o.mode === "ROUTE") {
      if (o.from.region2) keys.add(o.from.region2);
      if (o.to.region2) keys.add(o.to.region2);
      keys.add(o.from.publicLabel);
      keys.add(o.to.publicLabel);
      continue;
    }
    if (o.place.region2) keys.add(o.place.region2);
    keys.add(o.place.publicLabel);
  }
  return [...keys];
}

/**
 * V1 region-based nearby check — NOT GPS distance.
 * Same region2 / overlapping publicLabel counts as nearby.
 */
export function isNearbyFulfillment(
  options: FulfillmentOption[],
  viewerDefaultArea: string,
): boolean {
  if (hasRemoteOption(options) || hasShippingOption(options)) return false;
  const needle = viewerDefaultArea.trim().toLowerCase();
  if (!needle) return false;
  for (const key of collectRegion2Keys(options)) {
    const k = key.toLowerCase();
    if (k.includes(needle) || needle.includes(k)) return true;
  }
  return false;
}

export function matchesFeedAreaFilter(
  options: FulfillmentOption[],
  filter: FeedAreaFilter,
  viewerDefaultArea: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "online") {
    return hasRemoteOption(options) || hasShippingOption(options);
  }
  return isNearbyFulfillment(options, viewerDefaultArea);
}

/**
 * Basic compatibility helper — no false precision.
 * REMOTE/SHIPPING: always ok. Place modes: optional region overlap.
 */
export function isFulfillmentCompatibleWithArea(
  options: FulfillmentOption[],
  responderDefaultArea?: string,
): boolean {
  if (options.some((o) => o.mode === "REMOTE" || o.mode === "SHIPPING")) {
    return true;
  }
  if (!responderDefaultArea?.trim()) return true;
  return isNearbyFulfillment(options, responderDefaultArea);
}

/** Build Place from a simple public label (V1 input). */
export function placeFromLabel(
  label: string,
  regionHints?: { region1?: string; region2?: string; region3?: string },
): Place {
  const publicLabel = label.trim();
  return {
    publicLabel,
    region1: regionHints?.region1,
    region2: regionHints?.region2 ?? inferRegion2(publicLabel),
    region3: regionHints?.region3,
  };
}

/** Remove exact coordinates before any public persist/read. */
export function placeWithoutGeo(p: Place): Place {
  const { geo: _geo, ...rest } = p;
  return rest;
}

export function stripGeoFromFulfillmentOptions(
  options: FulfillmentOption[],
): FulfillmentOption[] {
  return options.map((option) => {
    switch (option.mode) {
      case "REMOTE":
      case "SHIPPING":
        return option;
      case "ROUTE":
        return {
          mode: "ROUTE",
          from: placeWithoutGeo(option.from),
          to: placeWithoutGeo(option.to),
        };
      default:
        return {
          ...option,
          place: placeWithoutGeo(option.place),
        };
    }
  });
}

/** First exact geo found in options (for private storage only). */
export function extractExactGeo(
  options: FulfillmentOption[],
): { lat: number; lng: number } | null {
  for (const option of options) {
    if (
      option.mode === "MEETUP" ||
      option.mode === "ONSITE" ||
      option.mode === "PICKUP"
    ) {
      const g = option.place.geo;
      if (g && Number.isFinite(g.lat) && Number.isFinite(g.lng)) {
        return { lat: g.lat, lng: g.lng };
      }
    }
    if (option.mode === "ROUTE") {
      const g = option.from.geo ?? option.to.geo;
      if (g && Number.isFinite(g.lat) && Number.isFinite(g.lng)) {
        return { lat: g.lat, lng: g.lng };
      }
    }
  }
  return null;
}

function inferRegion2(label: string): string | undefined {
  if (label.includes("평택")) return "평택시";
  if (label.includes("강남")) return "강남구";
  if (label.includes("성동") || label.includes("성수")) return "성동구";
  if (label.includes("마포")) return "마포구";
  if (label.includes("해운대")) return "해운대구";
  if (label.includes("서울")) return "서울";
  if (label.includes("경기")) return "경기";
  if (label.includes("부산")) return "부산";
  return undefined;
}

/** Fallback when reading legacy location-only rows. */
export function fulfillmentFromLegacyLocation(location: string): FulfillmentOption[] {
  const label = location.trim();
  if (!label) return [{ mode: "REMOTE" }];
  if (label === ko.fulfillRemote || label.includes("온라인")) {
    return [{ mode: "REMOTE" }];
  }
  if (label.includes("택배") || label === ko.shipping) {
    return [{ mode: "SHIPPING" }];
  }
  return [{ mode: "MEETUP", place: placeFromLabel(label) }];
}
