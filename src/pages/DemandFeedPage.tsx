import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { IndividualDemandCard } from "@/components/IndividualDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/Input";
import {
  fetchApproxDistancesRemote,
  searchLiveDemandRemote,
  type RemoteLiveDemandRow,
} from "@/data/supabase/api";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import {
  distanceRequestBatches,
  hasPhysicalFulfillment,
  matchesLocationDiscovery,
  type LocationDiscoveryMode,
} from "@/domain/locationDiscovery";
import { clearViewerGeo, type ViewerGeo } from "@/lib/geoDistance";
import { requestViewerGeo } from "@/lib/requestViewerGeo";
import { translate, useDanLocale } from "@/i18n/locale";
import { addSavedArea, useSavedAreas } from "@/lib/savedAreas";
import {
  filterAndSortLiveDemand,
  liveDemandCategoryCounts,
  type LiveDemandCategory,
  type LiveDemandRow,
  type LiveDemandSort,
} from "@/domain/liveDemandDiscovery";
import {
  CATEGORY_LABEL,
  DEMAND_TYPE_LABEL,
  type DemandType,
  type FeedItem,
} from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

const PAGE_SIZE = 24;

const SORT_OPTIONS: Array<{ value: LiveDemandSort; label: string }> = [
  { value: "popular", label: "인기" },
  { value: "growing", label: "급상승" },
  { value: "price", label: "가격" },
];

type RequestTypeFilter = "all" | DemandType;

const LOCATION_MODES: Array<{ value: LocationDiscoveryMode; label: string }> = [
  { value: "all", label: "전체 지역" },
  { value: "nearby", label: "내 주변" },
  { value: "area", label: "지역명" },
  { value: "online", label: "온라인·택배" },
  { value: "route", label: "동선 심부름" },
];

const REQUEST_TYPES: Array<{ value: RequestTypeFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "BUY", label: "구매" },
  { value: "BORROW", label: "빌리기" },
  { value: "TASK", label: "심부름" },
  { value: "SERVICE", label: "서비스" },
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
  const [params] = useSearchParams();
  const urlQuery = params.get("q")?.trim() ?? "";
  const urlArea = params.get("area")?.trim() ?? "";
  const urlCountry = params.get("country");
  const [query, setQuery] = useState(urlQuery);
  const [requestType, setRequestType] = useState<RequestTypeFilter>("all");
  const [locationMode, setLocationMode] = useState<LocationDiscoveryMode>(urlArea ? "area" : "all");
  const [areaQuery, setAreaQuery] = useState(urlArea);
  const [areaCountry, setAreaCountry] = useState<"KR" | "JP">(urlCountry === "JP" || (!urlCountry && locale === "ja") ? "JP" : "KR");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [radiusKm, setRadiusKm] = useState(3);
  const [viewerGeo, setViewerGeo] = useState<ViewerGeo | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [distanceMap, setDistanceMap] = useState<Record<string, number>>({});
  const [distanceReady, setDistanceReady] = useState(false);
  const [category, setCategory] = useState<LiveDemandCategory>("all");
  const [sort, setSort] = useState<LiveDemandSort>("popular");
  const [page, setPage] = useState(0);
  const [remoteRows, setRemoteRows] = useState<LiveDemandRow[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const productionDiscovery = getDataMode() === "supabase";
  const includesBuy = requestType === "all" || requestType === "BUY";

  useEffect(() => {
    setQuery(urlQuery);
    setPage(0);
  }, [urlQuery]);
  useEffect(() => {
    if (!urlArea) return;
    setAreaQuery(urlArea);
    setLocationMode("area");
    setAreaCountry(urlCountry === "JP" ? "JP" : "KR");
  }, [urlArea, urlCountry]);

  const categoryRows = useMemo(
    () => liveDemandCategoryCounts(demandFeed),
    [demandFeed],
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

  const physicalDemandIds = useMemo(
    () => demandFeed
      .filter(
        (item): item is Extract<FeedItem, { kind: "individual" }> =>
          item.kind === "individual" && hasPhysicalFulfillment(item.demand),
      )
      .map((item) => item.demand.id),
    [demandFeed],
  );

  useEffect(() => {
    if (locationMode !== "nearby" || !viewerGeo || !productionDiscovery || !currentUser) {
      setDistanceMap({});
      setDistanceReady(false);
      return;
    }
    let cancelled = false;
    setDistanceMap({});
    setDistanceReady(false);
    void (async () => {
      try {
        const next: Record<string, number> = {};
        // Supabase distance RPC has a hard limit of 40 request IDs per call.
        // Run sequentially to avoid bursts; move to spatial server search at scale.
        for (const ids of distanceRequestBatches(physicalDemandIds)) {
          const distances = await fetchApproxDistancesRemote(ids, viewerGeo);
          Object.assign(next, distances);
          if (cancelled) return;
        }
        if (!cancelled) {
          setDistanceMap(next);
          setDistanceReady(true);
        }
      } catch {
        if (!cancelled) {
          setDistanceMap({});
          setDistanceReady(true);
          setLocationError(t("locationFailed"));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [locationMode, viewerGeo, productionDiscovery, currentUser?.id, physicalDemandIds]);

  useEffect(() => {
    if (!productionDiscovery || !includesBuy) {
      setRemoteRows([]);
      setRemoteTotal(0);
      setRemoteReady(false);
      setRemoteLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRemoteLoading(true);
      void searchLiveDemandRemote({
        query,
        category,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
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
        })
        .catch(() => {
          if (!cancelled) setRemoteReady(false);
        })
        .finally(() => {
          if (!cancelled) setRemoteLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [category, includesBuy, page, productionDiscovery, query, sort]);

  const buyRows =
    includesBuy
      ? productionDiscovery && remoteReady
        ? remoteRows
        : localBuyRows
      : [];

  const locationFilteredIndividualRows = useMemo(() => {
    const result = individualRows.filter((item) =>
      matchesLocationDiscovery(item.demand, {
        mode: locationMode,
        radiusKm,
        areaQuery,
        routeFrom,
        routeTo,
        approximateMetersById: distanceMap,
      }),
    );
    if (locationMode === "nearby") {
      result.sort(
        (a, b) => (distanceMap[a.demand.id] ?? Infinity) -
          (distanceMap[b.demand.id] ?? Infinity),
      );
    }
    return result;
  }, [individualRows, locationMode, radiusKm, areaQuery, routeFrom, routeTo, distanceMap]);

  const visibleFeed = useMemo<FeedItem[]>(() => {
    // Product-level BUY aggregates have no single request coordinate.
    // Never present them as a verified GPS-nearby result.
    if (requestType === "BUY") return locationMode === "all" ? buyRows : [];
    if (requestType !== "all") return locationFilteredIndividualRows;
    if (locationMode !== "all") return locationFilteredIndividualRows;
    return [...buyRows, ...locationFilteredIndividualRows].sort(
      (a, b) => b.sortAt.localeCompare(a.sortAt),
    );
  }, [buyRows, locationFilteredIndividualRows, locationMode, requestType]);

  const hasMore =
    locationMode === "all" &&
    requestType === "BUY" &&
    productionDiscovery &&
    remoteReady &&
    remoteRows.length < remoteTotal;

  const demandHref = query.trim()
    ? `/create?type=BUY&q=${encodeURIComponent(query.trim())}`
    : "/create";

  function resetRemoteDiscovery() {
    setRemoteRows([]);
    setRemoteTotal(0);
    setRemoteReady(false);
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
    if (value === "BUY") setLocationMode("all");
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

        <div className="request-type-filter" aria-label="요청 유형">
          {REQUEST_TYPES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={requestType === option.value ? "is-active" : ""}
              onClick={() => updateType(option.value)}
            >
              {option.value === "all" ? t("all") : option.value === "BUY" ? t("buy") : option.value === "BORROW" ? t("borrow") : option.value === "TASK" ? t("task") : t("service")}
            </button>
          ))}
        </div>

        <div className="location-discovery" aria-label="위치 기반 검색">
          <div className="location-discovery__heading">
            <strong>{t("selectArea")}</strong>
            <span>{t("privacyLocation")}</span>
          </div>
          <div className="location-discovery__modes" role="group" aria-label="지역 필터">
            {LOCATION_MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={locationMode === option.value ? "is-active" : ""}
                aria-pressed={locationMode === option.value}
                onClick={() => {
                  setLocationMode(option.value);
                  setLocationError(null);
                  if (option.value !== "all" && requestType === "BUY") setRequestType("all");
                }}
              >
                {option.value === "all" ? t("allAreas") : option.value === "nearby" ? t("nearby") : option.value === "area" ? t("byArea") : option.value === "route" ? t("route") : t("online")}
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
              <label>
                {t("chooseCountry")}
                <select value={areaCountry} onChange={(event) => setAreaCountry(event.target.value === "JP" ? "JP" : "KR")}>
                  <option value="KR">{t("countryKr")}</option>
                  <option value="JP">{t("countryJp")}</option>
                </select>
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
                  setAreaQuery(area.label); setAreaCountry(area.country); setLocationMode("area"); setSavedMessage(null);
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
                  {CATEGORY_LABEL[itemCategory]} <span>{count}</span>
                </button>
              ))}
            </div>

            <div className="discovery-toolbar">
              <p className="discovery-summary">
                {t("products", { n: buyRows.length })}
              </p>
              <div className="discovery-sort" aria-label="정렬">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={sort === option.value ? "is-active" : ""}
                    aria-pressed={sort === option.value}
                    onClick={() => updateSort(option.value)}
                  >
                    {option.value === "popular" ? t("popular") : option.value === "growing" ? t("growing") : t("price")}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="discovery-toolbar discovery-toolbar--simple">
            <p className="discovery-summary" aria-live="polite">
              {t("results", { n: visibleFeed.length })}
            </p>
          </div>
        )}
      </section>

      {distanceLoading || locating ? (
        <p className="discovery-loading" role="status">{t("locatingResults")}</p>
      ) : visibleFeed.length === 0 && !remoteLoading ? (
        <EmptyState
          title={query.trim() ? t("noMatchingSearch", { q: query.trim() }) : t("noRequests")}
          body={locationMode === "nearby"
            ? t("radiusEmpty")
            : locationMode === "area" && !areaQuery.trim()
              ? t("areaEmpty")
              : locationMode === "route" && (!routeFrom.trim() || !routeTo.trim())
                ? t("routeMissing")
                : t("noRequestsDetail")}
          action={<Button to={demandHref}>{t("createRequest")}</Button>}
        />
      ) : (
        <>
          <div className="mixed-demand-list" aria-busy={remoteLoading}>
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

          {remoteLoading ? (
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
        </>
      )}

      <section className="discovery-create-banner">
        <div>
          <span>{t("noRequests")}</span>
          <strong>{t("homeLead")}</strong>
        </div>
        <Button to="/create" variant="secondary">
          {t("createRequest")}
        </Button>
      </section>
    </div>
  );
}
