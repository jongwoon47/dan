import { ko } from "@/copy/ko";
import {
  aggregateDemands as aggregateDemandsDomain,
  listDemandAggregates as listDemandAggregatesDomain,
} from "./aggregation";
import { buildFeedItems } from "./feed";
import { placeFromLabel, type FulfillmentOption } from "./fulfillment";
import type {
  BorrowDemand,
  BuyDemand,
  Demand,
  DemandAggregate,
  Match,
  Ownership,
  Product,
  Response,
  SellIntent,
  ServiceDemand,
  TaskDemand,
  User,
} from "./types";

export const DEMO_USERS: User[] = [
  { id: "user-mina", name: ko.mina, defaultArea: ko.seongdong },
  { id: "user-jun", name: ko.jun, defaultArea: ko.mapo },
  { id: "user-hae", name: ko.hae, defaultArea: ko.haeundae },
  { id: "user-you", name: ko.you, defaultArea: ko.pyeongtaek },
];

export const CURRENT_USER_ID = "user-you";

export const PRODUCTS: Product[] = [
  {
    id: "prod-iphone-15-pro",
    name: "iPhone 15 Pro",
    brand: "Apple",
    model: "iPhone 15 Pro",
    category: "electronics",
    imageHue: 210,
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "prod-macbook-m4",
    name: "MacBook Pro 14 M4",
    brand: "Apple",
    model: "MacBook Pro 14 M4",
    category: "electronics",
    imageHue: 250,
    createdAt: "2026-01-12T00:00:00.000Z",
  },
  {
    id: "prod-sony-a7iv",
    name: "Sony A7 IV",
    brand: "Sony",
    model: "A7 IV",
    category: "camera",
    imageHue: 195,
    createdAt: "2026-01-14T00:00:00.000Z",
  },
  {
    id: "prod-switch-oled",
    name: "Nintendo Switch OLED",
    brand: "Nintendo",
    model: "Switch OLED",
    category: "electronics",
    imageHue: 340,
    createdAt: "2026-01-16T00:00:00.000Z",
  },
  {
    id: "prod-airpods-pro2",
    name: "AirPods Pro 2",
    brand: "Apple",
    model: "AirPods Pro 2",
    category: "electronics",
    imageHue: 220,
    createdAt: "2026-01-18T00:00:00.000Z",
  },
  {
    id: "prod-sony-2470-gm2",
    name: "Sony FE 24-70mm F2.8 GM II",
    brand: "Sony",
    model: "FE 24-70mm F2.8 GM II",
    category: "lens",
    imageHue: 210,
    createdAt: "2026-01-20T00:00:00.000Z",
  },
];

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buyFulfillment(index: number): FulfillmentOption[] {
  const patterns: FulfillmentOption[][] = [
    [{ mode: "SHIPPING" }, { mode: "MEETUP", place: placeFromLabel("???") }],
    [{ mode: "SHIPPING" }],
    [{ mode: "MEETUP", place: placeFromLabel("?? ???") }],
    [{ mode: "SHIPPING" }, { mode: "MEETUP", place: placeFromLabel("??") }],
    [{ mode: "MEETUP", place: placeFromLabel("??") }],
  ];
  return patterns[index % patterns.length]!;
}

function tradeFrom(options: FulfillmentOption[]) {
  const shipping = options.some((o) => o.mode === "SHIPPING");
  const meetup = options.some((o) => o.mode === "MEETUP");
  if (shipping && meetup) return "any" as const;
  if (shipping) return "shipping" as const;
  if (meetup) return "meetup" as const;
  return "any" as const;
}

function buySeed(
  productId: string,
  category: BuyDemand["category"],
  productName: string,
  entries: Array<[number, number]>,
): BuyDemand[] {
  const conditions: BuyDemand["details"]["conditionPreference"][] = [
    "any",
    "like_new",
    "lightly_used",
    "sealed",
    "any",
  ];
  return entries.map(([maxPrice, days], index) => {
    const fulfillmentOptions = buyFulfillment(index);
    return {
      id: `demand-${productId}-${index}`,
      userId: `seeker-${productId}-${index}`,
      type: "BUY" as const,
      title: `${productName} | ${Math.round(maxPrice / 10_000)}${ko.manWon}`,
      description: `${productName} / ${maxPrice.toLocaleString("ko-KR")}${ko.won}`,
      category,
      budget: maxPrice,
      fulfillmentOptions,
      status: "ACTIVE" as const,
      createdAt: daysAgo(days),
      expiresAt: daysFromNow(30 - (days % 10)),
      details: {
        productId,
        maxPrice,
        conditionPreference: conditions[index % conditions.length]!,
        tradeMethod: tradeFrom(fulfillmentOptions),
      },
    };
  });
}

const SEED_BUY: BuyDemand[] = [
  ...buySeed("prod-iphone-15-pro", "electronics", "iPhone 15 Pro", [
    [900000, 12],
    [950000, 10],
    [980000, 8],
    [1000000, 6],
    [1020000, 4],
    [1050000, 2],
    [990000, 1],
    [1010000, 0],
    [970000, 3],
    [1030000, 5],
    [1040000, 1],
    [960000, 7],
  ]),
  ...buySeed("prod-macbook-m4", "electronics", "MacBook Pro 14", [
    [2800000, 14],
    [2900000, 10],
    [3000000, 7],
    [3100000, 4],
    [3200000, 2],
    [2950000, 1],
  ]),
  ...buySeed("prod-sony-a7iv", "camera", "Sony A7 IV", [
    [2100000, 16],
    [2200000, 12],
    [2300000, 8],
    [2350000, 5],
    [2400000, 2],
    [2250000, 1],
    [2280000, 0],
    [2320000, 3],
  ]),
  ...buySeed("prod-switch-oled", "electronics", "Switch OLED", [
    [320000, 10],
    [340000, 7],
    [350000, 4],
    [360000, 2],
    [345000, 1],
  ]),
  ...buySeed("prod-airpods-pro2", "electronics", "AirPods Pro 2", [
    [220000, 9],
    [240000, 6],
    [250000, 3],
    [255000, 1],
    [245000, 0],
  ]),
  ...buySeed("prod-sony-2470-gm2", "lens", "Sony 24-70 GM II", [
    [1700000, 8],
    [1750000, 5],
    [1800000, 3],
    [1850000, 1],
    [1780000, 0],
  ]),
];

const SEED_BORROW: BorrowDemand[] = [
  {
    id: "demand-borrow-projector",
    userId: "user-jun",
    type: "BORROW",
    title: "?? ?? ????? ???",
    description: "?? ?? ????? ??? ????.",
    category: "rental",
    budget: 30000,
    fulfillmentOptions: [
      { mode: "PICKUP", place: placeFromLabel("??? ???") },
    ],
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(5),
    details: {
      itemName: "?????",
      startAt: daysFromNow(2),
      endAt: daysFromNow(4),
    },
  },
  {
    id: "demand-borrow-tent",
    userId: "user-hae",
    type: "BORROW",
    title: "?? ?? 2? ???",
    description: "2?3?? ??? ????.",
    category: "camping",
    budget: 30000,
    fulfillmentOptions: [
      { mode: "MEETUP", place: placeFromLabel("??") },
    ],
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(7),
    details: {
      itemName: "?? ??",
      startAt: daysFromNow(3),
      endAt: daysFromNow(5),
    },
  },
];

const SEED_TASK: TaskDemand[] = [
  {
    id: "demand-task-cake",
    userId: "user-hae",
    type: "TASK",
    title: "????? ??? ????? ?",
    description: "??? ???? ?? ????? ???? ???.",
    category: "errand",
    budget: 15000,
    fulfillmentOptions: [
      { mode: "PICKUP", place: placeFromLabel("??? ??") },
    ],
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(1),
    details: { taskDescription: "??? ??", dueAt: daysFromNow(0) },
  },
  {
    id: "demand-task-doc-route",
    userId: "user-mina",
    type: "TASK",
    title: "?? ??? ????? ?",
    description: "?? 8??? ?? ?? ? ?? ?????.",
    category: "errand",
    budget: 20000,
    fulfillmentOptions: [
      {
        mode: "ROUTE",
        from: placeFromLabel("???"),
        to: placeFromLabel("??"),
      },
    ],
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(1),
    details: { taskDescription: "?? ?? ? ??", dueAt: daysFromNow(0) },
  },
  {
    id: "demand-task-remote-form",
    userId: "user-jun",
    type: "TASK",
    title: "??? ??? ?? ??????",
    description: "? ?? ?? ??? ?????.",
    category: "errand",
    budget: 10000,
    fulfillmentOptions: [{ mode: "REMOTE" }],
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(3),
    details: { taskDescription: "??? ??? ?? ??" },
  },
];

const SEED_SERVICE: ServiceDemand[] = [
  {
    id: "demand-svc-ikea",
    userId: "user-mina",
    type: "SERVICE",
    title: "??? ?? ??????",
    description: "????? ??? ?? ?? ?????.",
    category: "furniture",
    budget: 40000,
    fulfillmentOptions: [
      { mode: "ONSITE", place: placeFromLabel("???") },
    ],
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(3),
    details: { serviceDescription: "??? ?? ??" },
  },
  {
    id: "demand-svc-ppt",
    userId: "user-hae",
    type: "SERVICE",
    title: "PPT ??? ?? ??????",
    description: "???? ????? ??? ??? ???.",
    category: "service",
    budget: 30000,
    fulfillmentOptions: [{ mode: "REMOTE" }],
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(2),
    details: { serviceDescription: "PPT ?? ??" },
  },
];

export const SEED_DEMANDS: Demand[] = [
  ...SEED_BUY,
  ...SEED_BORROW,
  ...SEED_TASK,
  ...SEED_SERVICE,
];

/** DEMO DISPLAY ONLY ? never import into production domain logic. */
export const DISPLAY_SEEKER_OVERRIDES: Record<string, number> = {
  "prod-iphone-15-pro": 28,
};

const DISPLAY_RECENT_DELTA_FLOOR: Record<string, number> = {
  "prod-iphone-15-pro": 6,
};

export const SEED_OWNERSHIPS: Ownership[] = [
  {
    id: "own-jun-a7iv",
    userId: "user-jun",
    productId: "prod-sony-a7iv",
    condition: "lightly_used",
    status: "OWNED",
    createdAt: daysAgo(40),
  },
  {
    id: "own-jun-2470",
    userId: "user-jun",
    productId: "prod-sony-2470-gm2",
    condition: "lightly_used",
    status: "OWNED",
    createdAt: daysAgo(40),
  },
];

export const SEED_SELL_INTENTS: SellIntent[] = [
  {
    id: "sell-jun-a7iv",
    ownershipId: "own-jun-a7iv",
    userId: "user-jun",
    productId: "prod-sony-a7iv",
    minimumPrice: 2_200_000,
    status: "OPEN",
    createdAt: daysAgo(2),
  },
  {
    id: "sell-jun-2470",
    ownershipId: "own-jun-2470",
    userId: "user-jun",
    productId: "prod-sony-2470-gm2",
    minimumPrice: 1_800_000,
    status: "OPEN",
    createdAt: daysAgo(2),
  },
];

export const SEED_RESPONSES: Response[] = [];
export const SEED_MATCHES: Match[] = [];

function applyDemoDisplayOverride(agg: DemandAggregate): DemandAggregate {
  const seekerOverride = DISPLAY_SEEKER_OVERRIDES[agg.productId];
  const recentFloor = DISPLAY_RECENT_DELTA_FLOOR[agg.productId];
  return {
    ...agg,
    seekerCount: seekerOverride ?? agg.seekerCount,
    recent7dDelta:
      recentFloor == null
        ? agg.recent7dDelta
        : Math.max(agg.recent7dDelta, recentFloor),
  };
}

export function aggregateDemandsDomainOnly(
  productId: string,
  demands: Demand[],
  nowMs?: number,
): DemandAggregate | null {
  return aggregateDemandsDomain(productId, demands, { nowMs });
}

export function aggregateDemands(
  productId: string,
  demands: Demand[],
  nowMs?: number,
): DemandAggregate | null {
  const agg = aggregateDemandsDomain(productId, demands, { nowMs });
  return agg ? applyDemoDisplayOverride(agg) : null;
}

export function listDemandAggregates(
  products: Product[],
  demands: Demand[],
  nowMs?: number,
) {
  return listDemandAggregatesDomain(products, demands, { nowMs }).map((row) => ({
    ...applyDemoDisplayOverride(row),
    product: row.product,
  }));
}

export function listDemoFeed(demands: Demand[] = SEED_DEMANDS) {
  return buildFeedItems(PRODUCTS, demands, {
    displaySeekerOverrides: DISPLAY_SEEKER_OVERRIDES,
    displayRecentDeltaFloor: DISPLAY_RECENT_DELTA_FLOOR,
  });
}
