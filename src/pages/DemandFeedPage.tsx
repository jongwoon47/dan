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
  const query = raw.trim().toLocaleLowerCase("ko-KR");
  if (!query) return true;
  const demand = item.demand;
  const hay = [
    demand.title,
    demand.description,
    DEMAND_TYPE_LABEL[demand.type],
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ko-KR");
  return hay.includes(query);
}

export function DemandFeedPage() {
  const { demandFeed, currentUser } = useDan();
  const [params] = useSearchParams();
  const urlQuery = params.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [requestType, setRequestType] = useState<RequestTypeFilter>("all");
  const [locationMode, setLocationMode] = useState<LocationDiscoveryMode>("all");
  const [areaQuery, setAreaQuery] = useState("");
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
          setLocationError("거리 정보를 확인하지 못했어요. 지역명 검색을 사용해 주세요.");
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
  }, [individualRows, locationMode, radiusKm, areaQuery, distanceMap]);

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
      setLocationError("거리 검색은 로그인한 계정에서 사용할 수 있어요. 지역명 검색은 누구나 이용할 수 있어요.");
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
          ? "위치 권한이 거부됐어요. 설정에서 허용하거나 지역명을 검색해 주세요."
          : "현재 위치를 찾지 못했어요. 다시 시도하거나 지역명을 검색해 주세요.",
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
        <span className="eyebrow">탐색</span>
        <h1 className="page-title">지금 올라온 요청</h1>
        <p className="section-desc">
          물건 구매부터 빌리기, 심부름, 서비스까지 올라온 요청을 둘러보세요.
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
            placeholder="물건, 심부름, 서비스 검색"
            aria-label="요청 검색"
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
              {option.label}
            </button>
          ))}
        </div>

        <div className="location-discovery" aria-label="위치 기반 검색">
          <div className="location-discovery__heading">
            <strong>어디서 찾을까요?</strong>
            <span>정확한 현재 위치는 공개하지 않아요</span>
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
                {option.label}
              </button>
            ))}
          </div>
          {locationMode === "nearby" ? (
            <div className="location-discovery__detail">
              <label>
                탐색 반경
                <select
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  aria-label="탐색 반경"
                >
                  {[1, 3, 5, 10].map((km) =>
                    <option key={km} value={km}>약 {km}km 이내</option>,
                  )}
                </select>
              </label>
              <button type="button" className="location-discovery__action" disabled={locating} onClick={() => void refreshViewerLocation()}>
                {locating ? "위치 확인 중…" : viewerGeo ? "현재 위치 새로 확인" : "현재 위치 사용"}
              </button>
              <p>거리 확인이 가능한 현장 요청만 표시해요. 거리 정보가 없는 요청과 제품별 구매 집계는 제외돼요.</p>
            </div>
          ) : null}
          {locationMode === "area" ? (
            <div className="location-discovery__detail">
              <label>
                지역 이름
                <input
                  aria-label="지역 이름 입력"
                  value={areaQuery}
                  onChange={(event) => setAreaQuery(event.target.value)}
                  placeholder="예: 성동구, 하카타구"
                  autoComplete="off"
                />
              </label>
              <p>게시물에 적힌 지역명으로 대략 검색해요. km 반경 검색과는 달라요.</p>
            </div>
          ) : null}
          {locationMode === "online" ? (
            <p className="location-discovery__note">온라인 또는 택배가 가능한 개별 요청만 표시해요.</p>
          ) : null}
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
                <strong>{buyRows.length}</strong>개 제품
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
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="discovery-toolbar discovery-toolbar--simple">
            <p className="discovery-summary" aria-live="polite">
              <strong>{visibleFeed.length}</strong>개 요청
            </p>
          </div>
        )}
      </section>

      {distanceLoading || locating ? (
        <p className="discovery-loading" role="status">주변 요청을 확인하는 중…</p>
      ) : visibleFeed.length === 0 && !remoteLoading ? (
        <EmptyState
          title={query.trim() ? `‘${query.trim()}’ 요청이 아직 없어요` : "조건에 맞는 요청이 없어요"}
          body={locationMode === "nearby"
            ? "현재 위치에서 거리 확인이 가능한 요청이 없어요. 다른 반경 또는 지역명 검색을 사용해 보세요."
            : locationMode === "area" && !areaQuery.trim()
              ? "검색할 지역 이름을 입력해 주세요."
              : "필요한 것을 먼저 요청하면 다른 사람이 제안할 수 있어요."}
          action={<Button to={demandHref}>요청 올리기</Button>}
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
            <p className="discovery-loading" role="status">요청 불러오는 중…</p>
          ) : null}

          {hasMore ? (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setPage((value) => value + 1)}
            >
              더 보기
            </Button>
          ) : null}
        </>
      )}

      <section className="discovery-create-banner">
        <div>
          <span>원하는 요청이 없나요?</span>
          <strong>구매, 빌리기, 심부름, 서비스 중 필요한 요청을 먼저 올려보세요.</strong>
        </div>
        <Button to="/create" variant="secondary">
          요청 올리기
        </Button>
      </section>
    </div>
  );
}
