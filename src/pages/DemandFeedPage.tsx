import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { IndividualDemandCard } from "@/components/IndividualDemandCard";
import { NearbyBandMap } from "@/components/NearbyBandMap";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/Input";
import {
  listDemandsByIds,
  searchNearbyDemandDistancesRemote,
  searchLiveDemandRemote,
  type RemoteLiveDemandRow,
} from "@/data/supabase/api";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { type LocationDiscoveryMode } from "@/domain/locationDiscovery";
import {
  rankEligibleRequests,
  type PhysicalDiscoverySort,
} from "@/domain/requestRanking";
import { rankRouteCandidatesSync } from "@/domain/routeCandidates";
import { clearViewerGeo, type ViewerGeo } from "@/lib/geoDistance";
import { requestViewerGeo } from "@/lib/requestViewerGeo";
import { externalRouteUrl } from "@/lib/mapLinks";
import { translate, useDanLocale } from "@/i18n/locale";
import { categoryLabel } from "@/i18n/categories";
import { addSavedArea, useSavedAreas } from "@/lib/savedAreas";
import {
  resolveMarketCountry,
  writeStoredMarketCountry,
  type MarketCountry,
} from "@/lib/marketPrefs";
import { listPilotRegions, type PilotRegion } from "@/lib/pilotRegions";
import {
  filterAndSortLiveDemand,
  liveDemandCategoryCounts,
  type LiveDemandCategory,
  type LiveDemandRow,
  type LiveDemandSort,
} from "@/domain/liveDemandDiscovery";
import {
  DEMAND_TYPE_LABEL,
  type DemandType,
  type FeedItem,
} from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

const PAGE_SIZE = 24;
const NEARBY_PAGE_SIZE = 40;

const SORT_OPTIONS: Array<{ value: LiveDemandSort; labelKey: "popular" | "growing" | "price" }> = [
  { value: "popular", labelKey: "popular" },
  { value: "growing", labelKey: "growing" },
  { value: "price", labelKey: "price" },
];

const PHYSICAL_SORT_OPTIONS: Array<{ value: PhysicalDiscoverySort; labelKey: "sortNearest" | "sortNewest" | "sortRelevance" }> = [
  { value: "nearest", labelKey: "sortNearest" },
  { value: "newest", labelKey: "sortNewest" },
  { value: "relevance", labelKey: "sortRelevance" },
];

type RequestTypeFilter = "all" | DemandType;

const LOCATION_MODES: Array<{ value: LocationDiscoveryMode; labelKey: "allAreas" | "nearby" | "byArea" | "online" | "route" }> = [
  { value: "all", labelKey: "allAreas" },
  { value: "nearby", labelKey: "nearby" },
  { value: "area", labelKey: "byArea" },
  { value: "online", labelKey: "online" },
  { value: "route", labelKey: "route" },
];

const REQUEST_TYPES: Array<{ value: RequestTypeFilter; labelKey: "all" | "buy" | "borrow" | "task" | "service" }> = [
  { value: "all", labelKey: "all" },
  { value: "BUY", labelKey: "buy" },
  { value: "BORROW", labelKey: "borrow" },
  { value: "TASK", labelKey: "task" },
  { value: "SERVICE", labelKey: "service" },
];

function toFeedRow(row: RemoteLiveDemandRow): LiveDemandRow {
  return {
    kind: "aggregated",
    id: `remote:${row.product.id}`,
    product: row.product,
    aggregate: row.aggregate,
    sortAt: row.latestDemandAt,
  };
}

function matchesIndividualQuery(item: Extract<FeedItem, { kind: "individual" }>, raw: string) {
  const query = raw.trim().normalize("NFKC").toLocaleLowerCase();
  if (!query) return true;
  const demand = item.demand;
  const hay = [
    demand.title,
    demand.description,
    DEMAND_TYPE_LABEL[demand.type],
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC").toLocaleLowerCase();
  return hay.includes(query);
}

export function DemandFeedPage() {
  const locale = useDanLocale();
  const t = (key: Parameters<typeof translate>[1], vars: Record<string, string | number> = {}) => translate(locale, key, vars);
  const savedAreas = useSavedAreas();
  const { demandFeed, currentUser } = useDan();
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get("q")?.trim() ?? "";
  const urlArea = params.get("area")?.trim() ?? "";
  const urlCountry = params.get("country");
  const [query, setQuery] = useState(urlQuery);
  const [requestType, setRequestType] = useState<RequestTypeFilter>("all");
  const [locationMode, setLocationMode] = useState<LocationDiscoveryMode>(urlArea ? "area" : "all");
  const [areaQuery, setAreaQuery] = useState(urlArea);
  const [areaCountry, setAreaCountry] = useState<MarketCountry>(() => resolveMarketCountry(urlCountry));
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [radiusKm, setRadiusKm] = useState(3);
  const [viewerGeo, setViewerGeo] = useState<ViewerGeo | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [distanceMap, setDistanceMap] = useState<Record<string, number>>({});
  const [distanceReady, setDistanceReady] = useState(false);
  const [nearbyRows, setNearbyRows] = useState<Array<Extract<FeedItem, { kind: "individual" }>>>([]);
  const [nearbyOffset, setNearbyOffset] = useState(0);
  const [nearbyHasMore, setNearbyHasMore] = useState(false);
  const [nearbyLoadingMore, setNearbyLoadingMore] = useState(false);
  const [physicalSort, setPhysicalSort] = useState<PhysicalDiscoverySort>("nearest");
  const [resultView, setResultView] = useState<"list" | "map">("list");
  const [category, setCategory] = useState<LiveDemandCategory>("all");
  const [sort, setSort] = useState<LiveDemandSort>("popular");
  const [page, setPage] = useState(0);
  const [remoteRows, setRemoteRows] = useState<LiveDemandRow[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [discoveryRetry, setDiscoveryRetry] = useState(0);
  const [pilotRegions, setPilotRegions] = useState<PilotRegion[]>([]);
  const productionDiscovery = getDataMode() === "supabase";
  const includesBuy = areaCountry === "KR" && (requestType === "all" || requestType === "BUY");

  useEffect(() => {
    setQuery(urlQuery);
    setPage(0);
  }, [urlQuery]);
  useEffect(() => {
    const market = resolveMarketCountry(urlCountry);
    setAreaCountry(market);
    writeStoredMarketCountry(market);
    if (!urlArea) return;
    setAreaQuery(urlArea);
    setLocationMode("area");
  }, [urlArea, urlCountry]);

  useEffect(() => {
    if (areaCountry !== "JP" || !productionDiscovery || !currentUser) {
      setPilotRegions([]);
      return;
    }
    let cancelled = false;
    void listPilotRegions("JP").then((rows) => {
      if (!cancelled) setPilotRegions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [areaCountry, productionDiscovery, currentUser?.id]);

  function selectMarket(next: MarketCountry) {
    setAreaCountry(next);
    writeStoredMarketCountry(next);
    const nextParams = new URLSearchParams(params);
    nextParams.set("country", next);
    setParams(nextParams, { replace: true });
  }

  const categoryRows = useMemo(
    () => areaCountry === "KR" ? liveDemandCategoryCounts(demandFeed) : [],
    [demandFeed, areaCountry],
  );

  const localBuyRows = useMemo(
    () =>
      filterAndSortLiveDemand(demandFeed, {
        query,
        category,
        sort,
      }),
    [category, demandFeed, query, sort],
  );

  const individualRows = useMemo(
    () =>
      demandFeed
        .filter(
          (item): item is Extract<FeedItem, { kind: "individual" }> =>
            item.kind === "individual" &&
            (requestType === "all" || item.demand.type === requestType) &&
            matchesIndividualQuery(item, query),
        )
        .sort((a, b) => b.sortAt.localeCompare(a.sortAt)),
    [demandFeed, query, requestType],
  );

  useEffect(() => {
    if (locationMode !== "nearby" || !viewerGeo || !productionDiscovery || !currentUser) {
      setDistanceMap({});
      setNearbyRows([]);
      setNearbyOffset(0);
      setNearbyHasMore(false);
      setDistanceReady(false);
      return;
    }
    let cancelled = false;
    setDistanceMap({});
    setNearbyRows([]);
    setNearbyOffset(0);
    setNearbyHasMore(false);
    setDistanceReady(false);
    setLocationError(null);
    void (async () => {
      try {
        // Do not enumerate public demand IDs to a distance oracle. The server
        // picks active, policy-visible results and returns coarse km distances.
        const distances = await searchNearbyDemandDistancesRemote(
          viewerGeo,
          radiusKm as 1 | 3 | 5 | 10,
          areaCountry,
          0,
        );
        const records = distances.length
          ? await listDemandsByIds(distances.map((entry) => entry.id))
          : [];
        if (cancelled) return;
        const byDistance = Object.fromEntries(distances.map((d) => [d.id, d.meters]));
        const rows = records
          .filter((demand) => byDistance[demand.id] != null)
          .map((demand): Extract<FeedItem, { kind: "individual" }> => ({
            kind: "individual",
            id: `nearby:${demand.id}`,
            demand,
            sortAt: demand.createdAt,
          }));
        setDistanceMap(byDistance);
        setNearbyRows(rows);
        setNearbyOffset(distances.length);
        setNearbyHasMore(distances.length >= NEARBY_PAGE_SIZE);
        setDistanceReady(true);
      } catch {
        if (!cancelled) {
          setDistanceMap({});
          setNearbyRows([]);
          setNearbyHasMore(false);
          setDistanceReady(true);
          setLocationError(t("locationFailed"));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [locationMode, viewerGeo, productionDiscovery, currentUser?.id, radiusKm, areaCountry, discoveryRetry]);

  useEffect(() => {
    if (!productionDiscovery || !includesBuy) {
      setRemoteRows([]);
      setRemoteTotal(0);
      setRemoteReady(false);
      setRemoteLoading(false);
      setRemoteError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRemoteLoading(true);
      setRemoteError(null);
      void searchLiveDemandRemote({
        query,
        category,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        countryCode: areaCountry,
      })
        .then((result) => {
          if (cancelled) return;
          const next = result.rows.map(toFeedRow);
          setRemoteRows((prev) => {
            if (page === 0) return next;
            const map = new Map(prev.map((row) => [row.product.id, row]));
            for (const row of next) map.set(row.product.id, row);
            return [...map.values()];
          });
          setRemoteTotal(result.total);
          setRemoteReady(true);
          setRemoteError(null);
        })
        .catch(() => {
          if (!cancelled) {
            setRemoteReady(false);
            setRemoteError(t("discoveryError"));
          }
        })
        .finally(() => {
          if (!cancelled) setRemoteLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [areaCountry, category, includesBuy, page, productionDiscovery, query, sort, discoveryRetry]);

  const buyRows =
    includesBuy
      ? productionDiscovery && remoteReady
        ? remoteRows
        : localBuyRows
      : [];

  const locationFilteredIndividualRows = useMemo(() => {
    const sourceRows = locationMode === "nearby"
      ? nearbyRows.filter((item) => matchesIndividualQuery(item, query))
      : individualRows.filter((item) => matchesIndividualQuery(item, query));
    const byId = new Map(sourceRows.map((item) => [item.demand.id, item]));

    // Route mode: design searchRouteCandidates — label specificity, no invented ETA.
    if (locationMode === "route") {
      const marketRows = sourceRows.filter(
        (item) =>
          (item.demand.countryCode ?? "KR") === areaCountry &&
          item.demand.status === "ACTIVE" &&
          (requestType === "all" || item.demand.type === requestType),
      );
      let ranked = rankRouteCandidatesSync(
        marketRows.map((item) => item.demand),
        { routeFrom, routeTo },
      );
      if (physicalSort === "newest") {
        ranked = [...ranked].sort((a, b) =>
          b.demand.createdAt.localeCompare(a.demand.createdAt),
        );
      }
      return ranked
        .map((candidate) => byId.get(candidate.demand.id))
        .filter((item): item is Extract<FeedItem, { kind: "individual" }> => Boolean(item));
    }

    const locationFilter = {
      mode: locationMode,
      radiusKm,
      areaQuery,
      routeFrom,
      routeTo,
      approximateMetersById: distanceMap,
    } as const;
    const sortMode: PhysicalDiscoverySort =
      locationMode === "nearby" || locationMode === "area"
        ? physicalSort
        : "newest";
    const ranked = rankEligibleRequests(
      sourceRows.map((item) => item.demand),
      {
        marketCountry: areaCountry,
        requestType,
        sort: sortMode,
        approximateMetersById: distanceMap,
        location: locationFilter,
      },
    );
    return ranked
      .map((demand) => byId.get(demand.id))
      .filter((item): item is Extract<FeedItem, { kind: "individual" }> => Boolean(item));
  }, [
    individualRows,
    nearbyRows,
    requestType,
    query,
    locationMode,
    radiusKm,
    areaQuery,
    routeFrom,
    routeTo,
    distanceMap,
    areaCountry,
    physicalSort,
  ]);

  const visibleFeed = useMemo<FeedItem[]>(() => {
    // Product-level BUY aggregates have no single request coordinate.
    // Never present them as a verified GPS-nearby result.
    if (requestType === "BUY") return locationMode === "all" && areaCountry === "KR" ? buyRows : locationFilteredIndividualRows;
    if (requestType !== "all") return locationFilteredIndividualRows;
    if (locationMode !== "all") return locationFilteredIndividualRows;
    return [...buyRows, ...locationFilteredIndividualRows].sort(
      (a, b) => b.sortAt.localeCompare(a.sortAt),
    );
  }, [buyRows, locationFilteredIndividualRows, locationMode, requestType, areaCountry]);

  const hasMore =
    locationMode === "all" &&
    requestType === "BUY" &&
    productionDiscovery &&
    remoteReady &&
    remoteRows.length < remoteTotal;

  const demandHref = areaCountry === "JP"
    ? "/create?country=JP"
    : query.trim()
      ? `/create?type=BUY&q=${encodeURIComponent(query.trim())}`
      : "/create";

  function resetRemoteDiscovery() {
    setRemoteRows([]);
    setRemoteTotal(0);
    setRemoteReady(false);
    setRemoteError(null);
  }

  async function loadMoreNearby() {
    if (!viewerGeo || nearbyLoadingMore || !nearbyHasMore) return;
    setNearbyLoadingMore(true);
    try {
      const distances = await searchNearbyDemandDistancesRemote(
        viewerGeo,
        radiusKm as 1 | 3 | 5 | 10,
        areaCountry,
        nearbyOffset,
      );
      const records = distances.length
        ? await listDemandsByIds(distances.map((entry) => entry.id))
        : [];
      const byDistance = Object.fromEntries(distances.map((d) => [d.id, d.meters]));
      setDistanceMap((prev) => ({ ...prev, ...byDistance }));
      setNearbyRows((prev) => {
        const seen = new Set(prev.map((row) => row.demand.id));
        const extra = records
          .filter((demand) => byDistance[demand.id] != null && !seen.has(demand.id))
          .map((demand): Extract<FeedItem, { kind: "individual" }> => ({
            kind: "individual",
            id: `nearby:${demand.id}`,
            demand,
            sortAt: demand.createdAt,
          }));
        return [...prev, ...extra];
      });
      setNearbyOffset((value) => value + distances.length);
      setNearbyHasMore(distances.length >= NEARBY_PAGE_SIZE);
    } catch {
      setLocationError(t("locationFailed"));
    } finally {
      setNearbyLoadingMore(false);
    }
  }

  function updateQuery(value: string) {
    resetRemoteDiscovery();
    setQuery(value);
    setPage(0);
  }

  function updateCategory(value: LiveDemandCategory) {
    resetRemoteDiscovery();
    setCategory(value);
    setPage(0);
  }

  function updateSort(value: LiveDemandSort) {
    resetRemoteDiscovery();
    setSort(value);
    setPage(0);
  }

  function updateType(value: RequestTypeFilter) {
    resetRemoteDiscovery();
    setRequestType(value);
    setPage(0);
    if (value !== "BUY") setCategory("all");
    // Changing request type does not reset the active location filter.
  }

  async function refreshViewerLocation() {
    if (!productionDiscovery || !currentUser) {
      setLocationError(t("locationLogin"));
      return;
    }
    setLocating(true);
    setLocationError(null);
    const result = await requestViewerGeo();
    setLocating(false);
    if (!result.ok) {
      clearViewerGeo();
      setViewerGeo(null);
      setLocationError(
        result.reason === "denied"
          ? t("locationDenied")
          : t("locationFailed"),
      );
      return;
    }
    setViewerGeo(result.viewer);
  }

  const distanceLoading = locationMode === "nearby" &&
    viewerGeo !== null && productionDiscovery && Boolean(currentUser) && !distanceReady;

  return (
    <div className="page-stack discovery-page discovery-page--v3">
      <header className="page-header discovery-header">
        <span className="eyebrow">{t("explore")}</span>
        <h1 className="page-title">{t("openRequests")}</h1>
        <p className="section-desc">
          {t("browseLead")}
        </p>
      </header>

      <section className="discovery-panel" aria-label="요청 탐색">
        <div className="discovery-search">
          <span className="discovery-search__icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15 15 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <TextInput
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("requestSearch")}
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="discovery-search__clear"
              aria-label="검색어 지우기"
              onClick={() => updateQuery("")}
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="request-type-filter" aria-label={t("requestSearch")}>
          {REQUEST_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={requestType === option.value ? "is-active" : ""}
              onClick={() => updateType(option.value)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        <div className="location-discovery" aria-label="위치 기반 검색">
          <div className="location-discovery__heading">
            <strong>{t("selectArea")}</strong>
            <span>{t("privacyLocation")}</span>
          </div>
          <label className="location-discovery__market">
            <span>{t("chooseCountry")}</span>
            <select
              value={areaCountry}
              onChange={(event) => selectMarket(event.target.value === "JP" ? "JP" : "KR")}
              aria-label={t("chooseCountry")}
            >
              <option value="KR">{t("countryKr")}</option>
              <option value="JP">{t("countryJp")}</option>
            </select>
          </label>
          <p className="location-discovery__note">{areaCountry === "JP" ? t("marketPilot") : t("marketHint")}</p>
          {areaCountry === "JP" ? (
            <div className="location-discovery__note" role="note">
              <p>{t("pilotRegionNote")}</p>
              {pilotRegions.length > 0 ? (
                <p>
                  {pilotRegions.map((region) => region.regionKey).join(" · ")}
                </p>
              ) : (
                <p>{t("pilotRegionEmpty")}</p>
              )}
            </div>
          ) : null}
          <div className="location-discovery__modes" role="group" aria-label={t("selectArea")}>
            {LOCATION_MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={locationMode === option.value ? "is-active" : ""}
                aria-pressed={locationMode === option.value}
                onClick={() => {
                  setLocationMode(option.value);
                  setLocationError(null);
                  // Preserve BUY filtering when switching location modes.
                }}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
          {locationMode === "nearby" ? (
            <div className="location-discovery__detail">
              <label>
                {t("searchRadius")}
                <select
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  aria-label="탐색 반경"
                >
                  {[1, 3, 5, 10].map((km) =>
                    <option key={km} value={km}>{t("aroundKm", { km })}</option>,
                  )}
                </select>
              </label>
              <button type="button" className="location-discovery__action" disabled={locating} onClick={() => void refreshViewerLocation()}>
                {locating ? t("locating") : viewerGeo ? t("refreshLocation") : t("currentLocation")}
              </button>
              <p>{t("nearestHint")}</p>
            </div>
          ) : null}
          {locationMode === "area" ? (
            <div className="location-discovery__detail">
              <label>
                {t("areaName")}
                <input
                  aria-label="지역 이름 입력"
                  value={areaQuery}
                  onChange={(event) => setAreaQuery(event.target.value)}
                  placeholder={t("areaExample")}
                  autoComplete="off"
                />
              </label>
              <button type="button" className="location-discovery__action" disabled={!areaQuery.trim() || savedAreas.length >= 3}
                onClick={() => {
                  const result = addSavedArea({ label: areaQuery, country: areaCountry });
                  setSavedMessage(result === "full" ? t("savedAreaFull") : result === "saved" || result === "exists" ? t("areaSaved") : t("savedAreaHint"));
                }}>{t("saveArea")}</button>
              <p>{t("areaHint")}</p>
            </div>
          ) : null}
          {locationMode === "route" ? (
            <div className="location-discovery__detail">
              <label>{t("routeFrom")}
                <input value={routeFrom} onChange={(event) => setRouteFrom(event.target.value)} placeholder={t("areaExample")} aria-label={t("routeFrom")} />
              </label>
              <label>{t("routeTo")}
                <input value={routeTo} onChange={(event) => setRouteTo(event.target.value)} placeholder={t("areaExample")} aria-label={t("routeTo")} />
              </label>
              <p>{t("routeHint")}</p>
              <p>{t("routeMetricsUnavailable")}</p>
              {externalRouteUrl("google", routeFrom, routeTo) && externalRouteUrl("apple", routeFrom, routeTo) ? (
                <div className="location-discovery__maps">
                  <a href={externalRouteUrl("google", routeFrom, routeTo)!} target="_blank" rel="noopener noreferrer">{t("googleMap")}</a>
                  <a href={externalRouteUrl("apple", routeFrom, routeTo)!} target="_blank" rel="noopener noreferrer">{t("appleMap")}</a>
                  <p>{t("routeMapDisclosure")}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {locationMode === "online" ? (
            <p className="location-discovery__note">{t("onlineHint")}</p>
          ) : null}
          {savedAreas.length > 0 ? (
            <div className="location-discovery__saved" aria-label={t("savedAreas")}>
              <span>{t("savedAreas")}</span>
              {savedAreas.map((area) => (
                <button key={area.country + area.label} type="button" onClick={() => {
                  setAreaQuery(area.label); setAreaCountry(area.country); setLocationMode("area"); setRequestType("all"); setSavedMessage(null);
                }}>{area.country} · {area.label}</button>
              ))}
            </div>
          ) : null}
          {savedMessage ? <p role="status" className="location-discovery__note">{savedMessage}</p> : null}
          {locationError ? <p role="alert" className="location-discovery__error">{locationError}</p> : null}
        </div>

        {requestType === "BUY" ? (
          <>
            <div className="discovery-filter-scroll" aria-label="제품 카테고리">
              <button
                type="button"
                className={category === "all" ? "discovery-chip is-active" : "discovery-chip"}
                onClick={() => updateCategory("all")}
              >
                전체
              </button>
              {categoryRows.map(([itemCategory, count]) => (
                <button
                  key={itemCategory}
                  type="button"
                  className={category === itemCategory ? "discovery-chip is-active" : "discovery-chip"}
                  onClick={() => updateCategory(itemCategory)}
                >
                  {categoryLabel(locale, itemCategory)} <span>{count}</span>
                </button>
              ))}
            </div>

            <div className="discovery-toolbar">
              <p className="discovery-summary">
                {t("products", { n: buyRows.length })}
              </p>
              <div className="discovery-sort" aria-label={t("popular")}>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={sort === option.value ? "is-active" : ""}
                    aria-pressed={sort === option.value}
                    onClick={() => updateSort(option.value)}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="discovery-toolbar">
            <p className="discovery-summary" aria-live="polite">
              {t("results", { n: visibleFeed.length })}
            </p>
            {locationMode === "nearby" || locationMode === "area" || locationMode === "route" ? (
              <div className="discovery-sort" aria-label={t("sortNearest")}>
                {PHYSICAL_SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={physicalSort === option.value ? "is-active" : ""}
                    aria-pressed={physicalSort === option.value}
                    onClick={() => setPhysicalSort(option.value)}
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {locationMode === "nearby" ? (
          <div className="discovery-view-toggle" role="group" aria-label={t("mapView")}>
            <button
              type="button"
              className={resultView === "list" ? "is-active" : ""}
              aria-pressed={resultView === "list"}
              onClick={() => setResultView("list")}
            >
              {t("listView")}
            </button>
            <button
              type="button"
              className={resultView === "map" ? "is-active" : ""}
              aria-pressed={resultView === "map"}
              onClick={() => setResultView("map")}
            >
              {t("mapView")}
            </button>
            <p className="location-discovery__note">{t("mapViewSoon")}</p>
          </div>
        ) : (
          <p className="location-discovery__note">{t("mapViewSoon")}</p>
        )}
      </section>

      {remoteError && includesBuy ? (
        <EmptyState
          title={t("discoveryError")}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                resetRemoteDiscovery();
                setDiscoveryRetry((value) => value + 1);
              }}
            >
              {t("retryDiscovery")}
            </Button>
          }
        />
      ) : distanceLoading || locating || (remoteLoading && visibleFeed.length === 0) ? (
        <p className="discovery-loading" role="status">
          {distanceLoading || locating ? t("locatingResults") : t("loading")}
        </p>
      ) : locationError && locationMode === "nearby" && !viewerGeo ? (
        <EmptyState
          title={locationError}
          body={t("areaHint")}
          action={<Button onClick={() => setLocationMode("area")}>{t("byArea")}</Button>}
        />
      ) : visibleFeed.length === 0 ? (
        <EmptyState
          title={query.trim() ? t("noMatchingSearch", { q: query.trim() }) : t("noProducts")}
          body={locationMode === "nearby"
            ? t("radiusEmpty")
            : locationMode === "area" && !areaQuery.trim()
              ? t("areaEmpty")
              : locationMode === "route" && (!routeFrom.trim() || !routeTo.trim())
                ? t("routeMissing")
                : query.trim()
                  ? t("noRequestsDetail")
                  : t("noProductsDetail")}
          action={<Button to={demandHref}>{t("createRequest")}</Button>}
        />
      ) : (
        <>
          {locationMode === "nearby" && resultView === "map" ? (
            <NearbyBandMap
              radiusKm={radiusKm}
              items={visibleFeed
                .filter((item): item is Extract<FeedItem, { kind: "individual" }> => item.kind === "individual")
                .map((item) => ({
                  demand: item.demand,
                  approxMeters: distanceMap[item.demand.id],
                }))}
            />
          ) : (
            <div className="mixed-demand-list" aria-busy={remoteLoading || nearbyLoadingMore}>
              {visibleFeed.map((item) =>
                item.kind === "aggregated" ? (
                  <AggregatedDemandCard
                    key={item.id}
                    product={item.product}
                    aggregate={item.aggregate}
                  />
                ) : (
                  <IndividualDemandCard
                    key={item.id}
                    demand={item.demand}
                    approxMeters={locationMode === "nearby" ? distanceMap[item.demand.id] : undefined}
                  />
                ),
              )}
            </div>
          )}

          {remoteLoading || nearbyLoadingMore ? (
            <p className="discovery-loading" role="status">{t("loading")}</p>
          ) : null}

          {hasMore ? (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setPage((value) => value + 1)}
            >
              {t("loadMore")}
            </Button>
          ) : null}

          {locationMode === "nearby" && nearbyHasMore ? (
            <Button
              variant="secondary"
              fullWidth
              disabled={nearbyLoadingMore}
              onClick={() => void loadMoreNearby()}
            >
              {t("loadMoreNearby")}
            </Button>
          ) : null}
        </>
      )}

      <section className="discovery-create-banner">
        <div>
          <span>{t("createRequest")}</span>
          <strong>{t("homeLead")}</strong>
        </div>
        <Button to={demandHref} variant="secondary">
          {t("createRequest")}
        </Button>
      </section>
    </div>
  );
}
