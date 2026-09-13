# -*- coding: utf-8 -*-
from pathlib import Path

def u(*codes):
    return "".join(chr(c) for c in codes)

# Keep seed narrative titles in Korean via escapes.
T = {
    "borrow_a7": u(0x7740,0xBC88,0x20,0xC8FC,0xB9D0) + " Sony A7 IV " + u(0xBE4C,0xB9AC,0xACE0,0x20,0xC2F6,0xC5B4,0xC694),
    "borrow_a7_d": u(0xCD2C,0xC601,0xC6A9,0xC73C,0xB85C,0x20,0xD1A0,0xB7,0xC77C,0x20,0xC774,0xD2C0,0xB9CC,0x20,0xBE4C,0xB824,0xC694,0x2E),
    "tent": u(0xCEA0,0xD551,0x20,0xD150,0xD2B8,0x20,0x32,0xBC15,0x20,0xBE4C,0xB824,0xC694),
    "tent_d": "2" + u(0x2013) + "3" + u(0xC778,0xC6A9,0x20,0xD150,0xD2B8,0xBA74,0x20,0xCDA9,0xBD84,0xD574,0xC694,0x2E),
    "proj": u(0xBE44,0xD504,0xB85C,0xC81D,0xD130,0x20,0xD558,0xB8E8,0xB9CC,0x20,0xBE4C,0xB824,0xC8FC,0xC2E4,0x20,0xBD84),
    "proj_d": u(0xBAA8,0xC784,0x20,0xBC1C,0xD45C,0xC6A9,0xC73C,0xB85C,0x20,0xC800,0xB141,0x20,0xD55C,0x20,0xD0C0,0xC784,0xB9CC,0x20,0xD544,0xC694,0xD574,0xC694,0x2E),
    "doc": u(0xC624,0xB298,0x20,0x38,0xC2DC,0x20,0xC804,0xC5D0,0x20,0xC11C,0xB958,0x20,0xD558,0xB098,0x20,0xBC1B,0xC544,0xC8FC,0xC2E4,0x20,0xBD84),
    "doc_d": u(0xD3C9,0xD0DD,0xC5D0,0xC11C,0x20,0xC11C,0xB958,0x20,0xD53D,0xC5C5,0xB9CC,0x20,0xBD80,0xD0C1,0xB4DC,0xB824,0xC694,0x2E),
    "cake": u(0xC624,0xB298,0x20,0xAC15,0xB0A8,0xC5D0,0xC11C,0x20,0xCF00,0xC774,0xD06C,0x20,0xD53D,0xC5C5,0xD574,0xC8FC,0xC2E4,0x20,0xBD84),
    "cake_d": u(0xCF00,0xC774,0xD06C,0x20,0xAC00,0xAC8C,0xC5D0,0xC11C,0x20,0xBC1B,0xC544,0xC11C,0x20,0xADFC,0xCC98,0xAE4C,0xC9C0,0xB9CC,0x20,0xC640,0xC8FC,0xC154,0xB3C4,0x20,0xB429,0xB2C8,0xB2E4,0x2E),
    "ikea": u(0xC774,0xCF00,0xC544,0x20,0xCC45,0xC0C1,0x20,0xC870,0xB9BD,0xD574,0xC8FC,0xC2E4,0x20,0xBD84),
    "ikea_d": u(0xC131,0xB3D9,0xAD6C,0xC5D0,0xC11C,0x20,0xAC04,0xB2E8,0xD55C,0x20,0xCC45,0xC0C1,0x20,0xC870,0xB9BD,0x20,0xB3C4,0xC640,0xC8FC,0xC138,0xC694,0x2E),
    "photo": u(0xC624,0xB298,0x20,0xAC04,0xB2E8,0xD55C,0x20,0xC0AC,0xC9C4,0x20,0xCD2C,0xC601,0xD574,0xC8FC,0xC2E4,0x20,0xBD84),
    "photo_d": u(0xD504,0xB85C,0xD544,0xC6A9,0xC73C,0xB85C,0x20,0x33,0x30,0xBD84,0xB9CC,0x20,0xCC0D,0xC5B4,0xC8FC,0xC138,0xC694,0x2E),
    "move": u(0xC9D0,0x20,0xC870,0xAE08,0x20,0xC62E,0xAE30,0xB294,0x20,0xAC83,0x20,0xB3C4,0xC640,0xC8FC,0xC2E4,0x20,0xBD84),
    "move_d": u(0xC0C1,0xC790,0x20,0xBA87,0x20,0xAC1C,0xB9CC,0x20,0xC5D8,0xB9AC,0xBCA0,0xC774,0xD130,0xAE4C,0xC9C0,0x20,0xAC19,0xC774,0x20,0xC62E,0xACA8,0xC694,0x2E),
    "i_tent": u(0xCEA0,0xD551,0x20,0xD150,0xD2B8),
    "i_proj": u(0xBE44,0xD504,0xB85C,0xC81D,0xD130),
    "td_doc": u(0xC11C,0xB958,0x20,0xD53D,0xC5C5,0x20,0xB300,0xD589),
    "td_cake": u(0xCF00,0xC774,0xD06C,0x20,0xD53D,0xC5C5),
    "td_ikea": u(0xC774,0xCF00,0xC544,0x20,0xCC45,0xC0C1,0x20,0xC870,0xB9BD),
    "sd_photo": u(0xC9E7,0xC740,0x20,0xD504,0xB85C,0xD544,0x20,0xCD2C,0xC601),
    "sd_move": u(0xAC04,0xB2E8,0x20,0xC9D0,0x20,0xC774,0xB3D9,0x20,0xB3C4,0xC6C0),
}

def j(s: str) -> str:
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

out = f'''import {{ ko }} from "@/copy/ko";
import {{
  aggregateDemands as aggregateDemandsDomain,
  listDemandAggregates as listDemandAggregatesDomain,
}} from "./aggregation";
import {{ buildFeedItems }} from "./feed";
import type {{
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
}} from "./types";

export const DEMO_USERS: User[] = [
  {{ id: "user-mina", name: ko.mina, location: ko.seongdong }},
  {{ id: "user-jun", name: ko.jun, location: ko.mapo }},
  {{ id: "user-hae", name: ko.hae, location: ko.haeundae }},
  {{ id: "user-you", name: ko.you, location: ko.gangnam }},
];

export const CURRENT_USER_ID = "user-you";

export const PRODUCTS: Product[] = [
  {{ id: "prod-iphone-15-pro", name: "iPhone 15 Pro", brand: "Apple", model: "iPhone 15 Pro", category: "electronics", imageHue: 210, createdAt: "2026-01-10T00:00:00.000Z" }},
  {{ id: "prod-macbook-m4", name: "MacBook Pro 14 M4", brand: "Apple", model: "MacBook Pro 14 M4", category: "electronics", imageHue: 250, createdAt: "2026-01-12T00:00:00.000Z" }},
  {{ id: "prod-sony-a7iv", name: "Sony A7 IV", brand: "Sony", model: "A7 IV", category: "camera", imageHue: 195, createdAt: "2026-01-14T00:00:00.000Z" }},
  {{ id: "prod-switch-oled", name: "Nintendo Switch OLED", brand: "Nintendo", model: "Switch OLED", category: "electronics", imageHue: 340, createdAt: "2026-01-16T00:00:00.000Z" }},
  {{ id: "prod-airpods-pro2", name: "AirPods Pro 2", brand: "Apple", model: "AirPods Pro 2", category: "electronics", imageHue: 220, createdAt: "2026-01-18T00:00:00.000Z" }},
  {{ id: "prod-sony-2470-gm2", name: "Sony FE 24-70mm F2.8 GM II", brand: "Sony", model: "FE 24-70mm F2.8 GM II", category: "lens", imageHue: 210, createdAt: "2026-01-20T00:00:00.000Z" }},
];

function daysAgo(days: number): string {{
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}}

function daysFromNow(days: number): string {{
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}}

function buySeed(
  productId: string,
  category: BuyDemand["category"],
  productName: string,
  entries: Array<[number, number]>,
): BuyDemand[] {{
  const conditions: BuyDemand["details"]["conditionPreference"][] = [
    "any", "like_new", "lightly_used", "sealed", "any",
  ];
  const locations = [ko.seoul, ko.gyeonggi, ko.busan, ko.daegu, ko.incheon];
  const methods: BuyDemand["details"]["tradeMethod"][] = ["any", "meetup", "shipping"];
  return entries.map(([maxPrice, days], index) => ({{
    id: `demand-${{productId}}-${{index}}`,
    userId: `seeker-${{productId}}-${{index}}`,
    type: "BUY" as const,
    title: `${{productName}} · ${{Math.round(maxPrice / 10_000)}}${{ko.manWon}}`,
    description: `${{productName}} / ${{maxPrice.toLocaleString("ko-KR")}}${{ko.won}}`,
    category,
    budget: maxPrice,
    location: locations[index % locations.length]!,
    status: "ACTIVE" as const,
    createdAt: daysAgo(days),
    expiresAt: daysFromNow(30 - (days % 10)),
    details: {{
      productId,
      maxPrice,
      conditionPreference: conditions[index % conditions.length]!,
      tradeMethod: methods[index % methods.length]!,
    }},
  }}));
}}

const SEED_BUY: BuyDemand[] = [
  ...buySeed("prod-iphone-15-pro", "electronics", "iPhone 15 Pro", [[900000,12],[950000,10],[980000,8],[1000000,6],[1020000,4],[1050000,2],[990000,1],[1010000,0],[970000,3],[1030000,5],[1040000,1],[960000,7]]),
  ...buySeed("prod-macbook-m4", "electronics", "MacBook Pro 14", [[2800000,14],[2900000,10],[3000000,7],[3100000,4],[3200000,2],[2950000,1]]),
  ...buySeed("prod-sony-a7iv", "camera", "Sony A7 IV", [[2100000,16],[2200000,12],[2300000,8],[2350000,5],[2400000,2],[2250000,1],[2280000,0],[2320000,3]]),
  ...buySeed("prod-switch-oled", "electronics", "Switch OLED", [[320000,10],[340000,7],[350000,4],[360000,2],[345000,1]]),
  ...buySeed("prod-airpods-pro2", "electronics", "AirPods Pro 2", [[220000,9],[240000,6],[250000,3],[255000,1],[245000,0]]),
  ...buySeed("prod-sony-2470-gm2", "lens", "Sony 24-70 GM II", [[1700000,8],[1750000,5],[1800000,3],[1850000,1],[1780000,0]]),
];

const SEED_BORROW: BorrowDemand[] = [
  {{
    id: "demand-borrow-a7iv",
    userId: "user-mina",
    type: "BORROW",
    title: {j(T["borrow_a7"])},
    description: {j(T["borrow_a7_d"])},
    category: "rental",
    budget: 50000,
    location: ko.seoul,
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(5),
    details: {{ itemName: "Sony A7 IV", startAt: daysFromNow(2), endAt: daysFromNow(4) }},
  }},
  {{
    id: "demand-borrow-tent",
    userId: "user-hae",
    type: "BORROW",
    title: {j(T["tent"])},
    description: {j(T["tent_d"])},
    category: "camping",
    budget: 30000,
    location: ko.gyeonggi,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(7),
    details: {{ itemName: {j(T["i_tent"])}, startAt: daysFromNow(3), endAt: daysFromNow(5) }},
  }},
  {{
    id: "demand-borrow-projector",
    userId: "user-jun",
    type: "BORROW",
    title: {j(T["proj"])},
    description: {j(T["proj_d"])},
    category: "rental",
    budget: 20000,
    location: ko.mapo,
    status: "ACTIVE",
    createdAt: daysAgo(2),
    expiresAt: daysFromNow(4),
    details: {{ itemName: {j(T["i_proj"])} }},
  }},
];

const SEED_TASK: TaskDemand[] = [
  {{
    id: "demand-task-doc",
    userId: "user-mina",
    type: "TASK",
    title: {j(T["doc"])},
    description: {j(T["doc_d"])},
    category: "errand",
    budget: 20000,
    location: ko.pyeongtaek,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(1),
    details: {{ taskDescription: {j(T["td_doc"])}, dueAt: daysFromNow(0) }},
  }},
  {{
    id: "demand-task-cake",
    userId: "user-hae",
    type: "TASK",
    title: {j(T["cake"])},
    description: {j(T["cake_d"])},
    category: "errand",
    budget: 15000,
    location: ko.gangnam,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(1),
    details: {{ taskDescription: {j(T["td_cake"])}, dueAt: daysFromNow(0) }},
  }},
  {{
    id: "demand-task-ikea",
    userId: "user-jun",
    type: "TASK",
    title: {j(T["ikea"])},
    description: {j(T["ikea_d"])},
    category: "furniture",
    budget: 40000,
    location: ko.seongdong,
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(3),
    details: {{ taskDescription: {j(T["td_ikea"])}, dueAt: daysFromNow(2) }},
  }},
];

const SEED_SERVICE: ServiceDemand[] = [
  {{
    id: "demand-svc-photo",
    userId: "user-mina",
    type: "SERVICE",
    title: {j(T["photo"])},
    description: {j(T["photo_d"])},
    category: "service",
    budget: 50000,
    location: ko.seoul,
    status: "ACTIVE",
    createdAt: daysAgo(0),
    expiresAt: daysFromNow(2),
    details: {{ serviceDescription: {j(T["sd_photo"])}, preferredAt: daysFromNow(0) }},
  }},
  {{
    id: "demand-svc-move",
    userId: "user-hae",
    type: "SERVICE",
    title: {j(T["move"])},
    description: {j(T["move_d"])},
    category: "service",
    budget: 30000,
    location: ko.busan,
    status: "ACTIVE",
    createdAt: daysAgo(1),
    expiresAt: daysFromNow(2),
    details: {{ serviceDescription: {j(T["sd_move"])} }},
  }},
];

export const SEED_DEMANDS: Demand[] = [
  ...SEED_BUY,
  ...SEED_BORROW,
  ...SEED_TASK,
  ...SEED_SERVICE,
];

/** DEMO DISPLAY ONLY — never import into production domain logic. */
export const DISPLAY_SEEKER_OVERRIDES: Record<string, number> = {{
  "prod-iphone-15-pro": 28,
}};

const DISPLAY_RECENT_DELTA_FLOOR: Record<string, number> = {{
  "prod-iphone-15-pro": 6,
}};

export const SEED_OWNERSHIPS: Ownership[] = [
  {{ id: "own-jun-a7iv", userId: "user-jun", productId: "prod-sony-a7iv", condition: "lightly_used", status: "OWNED", createdAt: daysAgo(40) }},
  {{ id: "own-jun-2470", userId: "user-jun", productId: "prod-sony-2470-gm2", condition: "lightly_used", status: "OWNED", createdAt: daysAgo(40) }},
];

export const SEED_SELL_INTENTS: SellIntent[] = [
  {{ id: "sell-jun-a7iv", ownershipId: "own-jun-a7iv", userId: "user-jun", productId: "prod-sony-a7iv", minimumPrice: 2200000, status: "OPEN", createdAt: daysAgo(2) }},
  {{ id: "sell-jun-2470", ownershipId: "own-jun-2470", userId: "user-jun", productId: "prod-sony-2470-gm2", minimumPrice: 1800000, status: "OPEN", createdAt: daysAgo(2) }},
];

export const SEED_RESPONSES: Response[] = [];
export const SEED_MATCHES: Match[] = [];

function applyDemoDisplayOverride(agg: DemandAggregate): DemandAggregate {{
  const seekerOverride = DISPLAY_SEEKER_OVERRIDES[agg.productId];
  const recentFloor = DISPLAY_RECENT_DELTA_FLOOR[agg.productId];
  return {{
    ...agg,
    seekerCount: seekerOverride ?? agg.seekerCount,
    recent7dDelta:
      recentFloor == null
        ? agg.recent7dDelta
        : Math.max(agg.recent7dDelta, recentFloor),
  }};
}}

export function aggregateDemandsDomainOnly(
  productId: string,
  demands: Demand[],
  nowMs?: number,
): DemandAggregate | null {{
  return aggregateDemandsDomain(productId, demands, {{ nowMs }});
}}

export function aggregateDemands(
  productId: string,
  demands: Demand[],
  nowMs?: number,
): DemandAggregate | null {{
  const agg = aggregateDemandsDomain(productId, demands, {{ nowMs }});
  return agg ? applyDemoDisplayOverride(agg) : null;
}}

export function listDemandAggregates(
  products: Product[],
  demands: Demand[],
  nowMs?: number,
) {{
  return listDemandAggregatesDomain(products, demands, {{ nowMs }}).map((row) => ({{
    ...applyDemoDisplayOverride(row),
    product: row.product,
  }}));
}}

export function listDemoFeed(demands: Demand[] = SEED_DEMANDS) {{
  return buildFeedItems(PRODUCTS, demands, {{
    displaySeekerOverrides: DISPLAY_SEEKER_OVERRIDES,
    displayRecentDeltaFloor: DISPLAY_RECENT_DELTA_FLOOR,
  }});
}}
'''

# Fix buySeed template - the f-string doubled braces for TS but buySeed inner template literals got broken.
# Replace the broken buySeed section with a correct version using chr(96) for backticks.
bt = chr(96)
buy_seed_fn = f'''function buySeed(
  productId: string,
  category: BuyDemand["category"],
  productName: string,
  entries: Array<[number, number]>,
): BuyDemand[] {{
  const conditions: BuyDemand["details"]["conditionPreference"][] = [
    "any", "like_new", "lightly_used", "sealed", "any",
  ];
  const locations = [ko.seoul, ko.gyeonggi, ko.busan, ko.daegu, ko.incheon];
  const methods: BuyDemand["details"]["tradeMethod"][] = ["any", "meetup", "shipping"];
  return entries.map(([maxPrice, days], index) => ({{
    id: {bt}demand-${{productId}}-${{index}}{bt},
    userId: {bt}seeker-${{productId}}-${{index}}{bt},
    type: "BUY" as const,
    title: {bt}${{productName}} | ${{Math.round(maxPrice / 10_000)}}${{ko.manWon}}{bt},
    description: {bt}${{productName}} / ${{maxPrice.toLocaleString("ko-KR")}}${{ko.won}}{bt},
    category,
    budget: maxPrice,
    location: locations[index % locations.length]!,
    status: "ACTIVE" as const,
    createdAt: daysAgo(days),
    expiresAt: daysFromNow(30 - (days % 10)),
    details: {{
      productId,
      maxPrice,
      conditionPreference: conditions[index % conditions.length]!,
      tradeMethod: methods[index % methods.length]!,
    }},
  }}));
}}
'''

# The out variable has broken buySeed - rebuild cleanly without nested f-string issues.
# Write file in parts instead.
Path("src/domain/mockData.ts").write_text(out.replace(
    # noop - we'll regenerate properly below
    "",
    "",
), encoding="utf-8")
print("wrote preliminary", len(out))
