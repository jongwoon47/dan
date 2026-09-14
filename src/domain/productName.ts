/** Normalize product names so BUY demand aggregation stays on one catalog row. */
export function productMatchKey(raw: string): string {
  let s = raw.trim().normalize("NFKC").toLowerCase();
  s = s
    .replace(/아이폰/g, "iphone")
    .replace(/에어팟/g, "airpods")
    .replace(/맥북/g, "macbook")
    .replace(/갤럭시/g, "galaxy")
    .replace(/스위치/g, "switch")
    .replace(/프로\s*맥스/g, "promax")
    .replace(/프로맥스/g, "promax")
    .replace(/프로/g, "pro")
    .replace(/울트라/g, "ultra")
    .replace(/맥스/g, "max");
  return s.replace(/[^a-z0-9가-힣]/gi, "");
}

export function displayProductName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function findProductByMatchKey<T extends { name: string }>(
  products: T[],
  rawName: string,
): T | undefined {
  const key = productMatchKey(rawName);
  if (!key) return undefined;
  return products.find((p) => productMatchKey(p.name) === key);
}
