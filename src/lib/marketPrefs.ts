/** Persist selected storefront market independently of UI language. */

export type MarketCountry = "KR" | "JP";

const STORAGE_KEY = "dan-market-country-v1";

export function parseMarketCountry(raw: string | null | undefined): MarketCountry | null {
  if (raw === "JP" || raw === "KR") return raw;
  return null;
}

export function readStoredMarketCountry(): MarketCountry {
  try {
    return parseMarketCountry(localStorage.getItem(STORAGE_KEY)) ?? "KR";
  } catch {
    return "KR";
  }
}

export function writeStoredMarketCountry(country: MarketCountry): void {
  try {
    localStorage.setItem(STORAGE_KEY, country);
  } catch {
    /* ignore quota / private mode */
  }
}

/** URL wins when present; otherwise local preference; never infer from language. */
export function resolveMarketCountry(urlCountry: string | null | undefined): MarketCountry {
  return parseMarketCountry(urlCountry) ?? readStoredMarketCountry();
}
