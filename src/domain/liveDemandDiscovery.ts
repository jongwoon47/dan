import { productMatchKey } from "./productName";
import { CATEGORY_LABEL, type FeedItem, type ProductCategory } from "./types";

export type LiveDemandRow = Extract<FeedItem, { kind: "aggregated" }>;
export type LiveDemandCategory = "all" | ProductCategory;
export type LiveDemandSort = "popular" | "growing" | "price";

export type LiveDemandDiscoveryOptions = {
  query?: string;
  category?: LiveDemandCategory;
  sort?: LiveDemandSort;
};

export function listLiveDemandRows(items: FeedItem[]): LiveDemandRow[] {
  return items.filter(
    (item): item is LiveDemandRow =>
      item.kind === "aggregated" && item.aggregate.seekerCount > 0,
  );
}

export function liveDemandCategoryCounts(
  items: FeedItem[],
): Array<[ProductCategory, number]> {
  const counts = new Map<ProductCategory, number>();
  for (const row of listLiveDemandRows(items)) {
    counts.set(
      row.product.category,
      (counts.get(row.product.category) ?? 0) + row.aggregate.seekerCount,
    );
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function matchesQuery(row: LiveDemandRow, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const lower = query.toLocaleLowerCase("ko-KR");
  const matchKey = productMatchKey(query);
  const haystacks = [
    row.product.name,
    row.product.brand,
    row.product.model,
    CATEGORY_LABEL[row.product.category],
    row.aggregate.fulfillmentSummary ?? "",
  ];

  return haystacks.some((value) => {
    const normalized = value.toLocaleLowerCase("ko-KR");
    if (normalized.includes(lower)) return true;
    return Boolean(matchKey && productMatchKey(value).includes(matchKey));
  });
}

export function filterAndSortLiveDemand(
  items: FeedItem[],
  options: LiveDemandDiscoveryOptions = {},
): LiveDemandRow[] {
  const {
    query = "",
    category = "all",
    sort = "popular",
  } = options;

  const rows = listLiveDemandRows(items).filter(
    (row) =>
      (category === "all" || row.product.category === category) &&
      matchesQuery(row, query),
  );

  return rows.sort((a, b) => {
    if (sort === "growing") {
      return (
        b.aggregate.recent7dDelta - a.aggregate.recent7dDelta ||
        b.aggregate.seekerCount - a.aggregate.seekerCount ||
        b.aggregate.highestIntentPrice - a.aggregate.highestIntentPrice
      );
    }
    if (sort === "price") {
      return (
        b.aggregate.highestIntentPrice - a.aggregate.highestIntentPrice ||
        b.aggregate.seekerCount - a.aggregate.seekerCount ||
        b.aggregate.recent7dDelta - a.aggregate.recent7dDelta
      );
    }
    return (
      b.aggregate.seekerCount - a.aggregate.seekerCount ||
      b.aggregate.recent7dDelta - a.aggregate.recent7dDelta ||
      b.aggregate.highestIntentPrice - a.aggregate.highestIntentPrice
    );
  });
}
