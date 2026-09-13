import { ko } from "@/copy/ko";
import {
  aggregateDemands as aggregateDemandsDomain,
  listDemandAggregates as listDemandAggregatesDomain,
} from "./aggregation";
import { buildFeedItems } from "./feed";
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
  { id: "user-mina", name: ko.mina, location: ko.seongdong },
  { id: "user-jun", name: ko.jun, location: ko.mapo },
  { id: "user-hae", name: ko.hae, location: ko.haeundae },
  { id: "user-you", name: ko.you, location: ko.gangnam },
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
  const locations = [ko.seoul, ko.gyeonggi, ko.busan, ko.daegu, ko.incheon];
  const methods: BuyDemand["details"]["tradeMethod"][] = [
    "any",
    "meetup",
    "shipping",
  ];
  return entries.map(([maxPrice, days], index) => ({
    id: `demand-${productId}-${index}`,
    userId: `seeker-${productId}-${index}`,
    type: "BUY" as const,
    title: `${productName} | ${Math.round(maxPrice / 10_000)}${ko.manWon}`,
    description: `${productName} / ${maxPrice.toLocaleString("ko-KR")}${ko.won}`,
    category,
    budget: maxPrice,
    location: locations[index % locations.length]!,
    status: "ACTIVE" as const,
    createdAt: daysAgo(days),
    expiresAt: daysFromNow(30 - (days % 10)),
    details: {
      productId,
      maxPrice,
      conditionPreference: conditions[index % conditions.length]!,
      tradeMethod: methods[index % methods.length]!,
    },
  }));
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
    id: "demand-borrow-a7iv",
    userId: "user-mina",
    type: "BORROW",
    title: "이번 주말 Sony A7 IV 빌리고 싶어요",
    description: "컬영용으로 토·일 이틀만 빌려요.",
    category: "rental",
    budget: 50000,
    location: ko.seoul,
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(5),
    details: {
      itemName: "Sony A7 IV",
      startAt: daysFromNow(2),
      endAt: daysFromNow(4),
    },
  },
  {
    id: "demand-borrow-tent",
    userId: "user-hae",
    type: "BORROW",
    title: "캠핑 텐트 2박 빌려요",
    description: "2–3인용 텐트면 충분해요.",
    category: "camping",
    budget: 30000,
    location: ko.gyeonggi,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(7),
    details: {
      itemName: "캠핑 텐트",
      startAt: daysFromNow(3),
      endAt: daysFromNow(5),
    },
  },
  {
    id: "demand-borrow-projector",
    userId: "user-jun",
    type: "BORROW",
    title: "비프로젝터 하루만 빌려주실 분",
    description: "모임 발표용으로 저녁 한 타임만 필요해요.",
    category: "rental",
    budget: 20000,
    location: ko.mapo,
    status: "ACTIVE",
    createdAt: daysAgo(2),
    expiresAt: daysFromNow(4),
    details: { itemName: "비프로젝터" },
  },
];

const SEED_TASK: TaskDemand[] = [
  {
    id: "demand-task-doc",
    userId: "user-mina",
    type: "TASK",
    title: "오늘 8시 전에 서류 하나 받아주실 분",
    description: "평택에서 서류 픽업만 부탁드려요.",
    category: "errand",
    budget: 20000,
    location: ko.pyeongtaek,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(1),
    details: { taskDescription: "서류 픽업 대행", dueAt: daysFromNow(0) },
  },
  {
    id: "demand-task-cake",
    userId: "user-hae",
    type: "TASK",
    title: "오늘 강남에서 케이크 픽업해주실 분",
    description: "케이크 가게에서 받아서 근처까지만 와주셔도 됩니다.",
    category: "errand",
    budget: 15000,
    location: ko.gangnam,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(1),
    details: { taskDescription: "케이크 픽업", dueAt: daysFromNow(0) },
  },
  {
    id: "demand-task-ikea",
    userId: "user-jun",
    type: "TASK",
    title: "이케아 책상 조립해주실 분",
    description: "성동구에서 간단한 책상 조립 도와주세요.",
    category: "furniture",
    budget: 40000,
    location: ko.seongdong,
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(3),
    details: { taskDescription: "이케아 책상 조립", dueAt: daysFromNow(2) },
  },
];

const SEED_SERVICE: ServiceDemand[] = [
  {
    id: "demand-svc-photo",
    userId: "user-mina",
    type: "SERVICE",
    title: "오늘 간단한 사진 촬영해주실 분",
    description: "프로필용으로 30분만 찍어주세요.",
    category: "service",
    budget: 50000,
    location: ko.seoul,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(2),
    details: {
      serviceDescription: "짧은 프로필 촬영",
      preferredAt: daysFromNow(0),
    },
  },
  {
    id: "demand-svc-move",
    userId: "user-hae",
    type: "SERVICE",
    title: "짐 조금 옮기는 것 도와주실 분",
    description: "상자 몇 개만 엘리베이터까지 같이 옮겨요.",
    category: "service",
    budget: 30000,
    location: ko.busan,
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(2),
    details: { serviceDescription: "간단 짐 이동 도움" },
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
