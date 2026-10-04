import { describe, expect, it } from "vitest";
import {
  filterAndSortLiveDemand,
  liveDemandCategoryCounts,
} from "./liveDemandDiscovery";
import type { FeedItem, Product } from "./types";

function row(
  product: Pick<Product, "id" | "name" | "brand" | "model" | "category">,
  seekerCount: number,
  recent7dDelta: number,
  highestIntentPrice: number,
  fulfillmentSummary = "서울 · 직거래",
): FeedItem {
  return {
    kind: "aggregated",
    id: `aggregate-${product.id}`,
    product: {
      ...product,
      imageHue: 250,
      createdAt: "2026-09-30T00:00:00.000Z",
    },
    aggregate: {
      productId: product.id,
      seekerCount,
      minPrice: highestIntentPrice,
      maxPrice: highestIntentPrice,
      avgPrice: highestIntentPrice,
      recent7dDelta,
      highestIntentPrice,
      priceBuckets: [],
      fulfillmentSummary,
    },
    sortAt: "2026-09-30T00:00:00.000Z",
  };
}

const items: FeedItem[] = [
  row(
    { id: "chair", name: "Herman Miller Aeron Chair", brand: "Herman Miller", model: "Aeron", category: "furniture" },
    7,
    2,
    1_800_000,
  ),
  row(
    { id: "phone", name: "iPhone 15 Pro", brand: "Apple", model: "15 Pro", category: "electronics" },
    11,
    1,
    1_300_000,
    "택배 · 서울",
  ),
  row(
    { id: "camera", name: "Fujifilm X100VI", brand: "Fujifilm", model: "X100VI", category: "camera" },
    5,
    4,
    2_150_000,
  ),
];

describe("live demand discovery", () => {
  it("searches the whole open catalog, including non-camera products", () => {
    expect(filterAndSortLiveDemand(items, { query: "Aeron" }).map((x) => x.product.id)).toEqual(["chair"]);
    expect(filterAndSortLiveDemand(items, { query: "가구" }).map((x) => x.product.id)).toEqual(["chair"]);
    expect(filterAndSortLiveDemand(items, { query: "Apple" }).map((x) => x.product.id)).toEqual(["phone"]);
  });

  it("sorts by popularity, growth, or highest intent price", () => {
    expect(filterAndSortLiveDemand(items, { sort: "popular" })[0]?.product.id).toBe("phone");
    expect(filterAndSortLiveDemand(items, { sort: "growing" })[0]?.product.id).toBe("camera");
    expect(filterAndSortLiveDemand(items, { sort: "price" })[0]?.product.id).toBe("camera");
  });

  it("filters categories and counts active seekers", () => {
    expect(filterAndSortLiveDemand(items, { category: "furniture" }).map((x) => x.product.id)).toEqual(["chair"]);
    expect(Object.fromEntries(liveDemandCategoryCounts(items))).toMatchObject({
      electronics: 11,
      furniture: 7,
      camera: 5,
    });
  });
});
