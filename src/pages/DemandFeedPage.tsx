import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/Input";
import {
  searchLiveDemandRemote,
  type RemoteLiveDemandRow,
} from "@/data/supabase/api";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { effectiveDemandStatus } from "@/domain/demandLifecycle";
import {
  filterAndSortLiveDemand,
  liveDemandCategoryCounts,
  type LiveDemandCategory,
  type LiveDemandRow,
  type LiveDemandSort,
} from "@/domain/liveDemandDiscovery";
import { formatFulfillmentModes } from "@/domain/fulfillment";
import {
  CATEGORY_LABEL,
  DEMAND_TYPE_LABEL,
  type Demand,
  type DemandType,
} from "@/domain/types";
import { formatDemandWhen, formatWon } from "@/lib/format";
import "./pages.css";
import "@/components/feedCards.css";

const PAGE_SIZE = 24;
type ExploreType = "ALL" | DemandType;

const TYPE_FILTERS: Array<{ value: ExploreType; label: string }> = [
  { value: "ALL", label: "전체" },
  { value: "BUY", label: "구매" },
  { value: "BORROW", label: "빌리기" },
  { value: "TASK", label: "심부름" },
  { value: "SERVICE", label: "서비스" },
];

const SORT_OPTIONS: Array<{ value: LiveDemandSort; label: string }> = [
  { value: "popular", label: "인기" },
  { value: "growing", label: "급상승" },
  { value: "price", label: "희망가" },
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

function matchesRequestQuery(demand: Demand, query: string) {
  const needle = query.trim().toLocaleLowerCase("ko-KR");
  if (!needle) return true;
  return [demand.title, demand.description, DEMAND_TYPE_LABEL[demand.type]]
    .join(" ")
    .toLocaleLowerCase("ko-KR")
    .includes(needle);
}

function RequestRow({ demand }: { demand: Demand }) {
  return (
    <Link to={`/demand/item/${demand.id}`} className="explore-request-row">
      <span className={`explore-request-row__type explore-request-row__type--${demand.type.toLowerCase()}`}>
        {DEMAND_TYPE_LABEL[demand.type]}
      </span>
      <span className="explore-request-row__body">
        <strong>{demand.title}</strong>
        <span>
          {formatWon(demand.budget)}
          {formatFulfillmentModes(demand.fulfillmentOptions)
            ? ` · ${formatFulfillmentModes(demand.fulfillmentOptions)}`
            : ""}
        </span>
        {formatDemandWhen(demand) ? <small>{formatDemandWhen(demand)}</small> : null}
      </span>
      <span className="explore-request-row__chevron" aria-hidden>›</span>
    </Link>
  );
}

export function DemandFeedPage() {
  const { demandFeed, state } = useDan();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ExploreType>("ALL");
  const [category, setCategory] = useState<LiveDemandCategory>("all");
  const [sort, setSort] = useState<LiveDemandSort>("popular");
  const [page, setPage] = useState(0);
  const [remoteRows, setRemoteRows] = useState<LiveDemandRow[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const productionDiscovery = getDataMode() === "supabase";
  const showBuy = typeFilter === "ALL" || typeFilter === "BUY";

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

  const otherRequests = useMemo(
    () =>
      state.demands
        .filter(
          (demand) =>
            demand.type !== "BUY" &&
            effectiveDemandStatus(demand) === "ACTIVE" &&
            (typeFilter === "ALL" || demand.type === typeFilter) &&
            matchesRequestQuery(demand, query),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [query, state.demands, typeFilter],
  );

  useEffect(() => {
    if (!productionDiscovery || !showBuy) {
      setRemoteRows([]);
      setRemoteTotal(0);
      setRemoteReady(false);
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
  }, [category, page, productionDiscovery, query, showBuy, sort]);

  const buyRows = showBuy
    ? productionDiscovery && remoteReady
      ? remoteRows
      : localBuyRows
    : [];
  const totalBuyProducts =
    showBuy && productionDiscovery && remoteReady ? remoteTotal : buyRows.length;
  const hasMoreBuy =
    showBuy &&
    productionDiscovery &&
    remoteReady &&
    buyRows.length < remoteTotal;
  const totalVisible = totalBuyProducts + otherRequests.length;
  const createHref = typeFilter === "ALL" ? "/create" : `/create?type=${typeFilter}`;

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

  function updateType(value: ExploreType) {
    resetRemoteDiscovery();
    setTypeFilter(value);
    setCategory("all");
    setPage(0);
  }

  return (
    <div className="page-stack discovery-page discovery-page--v2">
      <header className="page-header discovery-header">
        <span className="eyebrow">탐색</span>
        <h1 className="page-title">지금 올라온 요청</h1>
        <p className="section-desc">
          사고, 빌리고, 부탁하고, 도움받고 싶은 요청을 한곳에서 찾아보세요.
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

        <div className="explore-type-tabs" role="tablist" aria-label="요청 유형">
          {TYPE_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={typeFilter === item.value}
              className={typeFilter === item.value ? "is-active" : ""}
              onClick={() => updateType(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {showBuy ? (
          <div className="discovery-filter-scroll" aria-label="제품 카테고리">
            <button
              type="button"
              className={category === "all" ? "discovery-chip is-active" : "discovery-chip"}
              onClick={() => updateCategory("all")}
            >
              모든 제품
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
        ) : null}

        <div className="discovery-toolbar">
          <p className="discovery-summary" aria-live="polite">
            <strong>{totalVisible}</strong>개 요청
          </p>
          {showBuy ? (
            <div className="discovery-sort" aria-label="구매 요청 정렬">
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
          ) : null}
        </div>
      </section>

      {totalVisible === 0 && !remoteLoading ? (
        <EmptyState
          title={query.trim() ? `‘${query.trim()}’ 요청이 아직 없어요` : "조건에 맞는 요청이 없어요"}
          body="먼저 요청을 올리면 가능한 사람이 가격과 조건을 제안할 수 있어요."
          action={<Button to={createHref}>요청 만들기</Button>}
        />
      ) : (
        <div className="explore-results">
          {otherRequests.length > 0 ? (
            <section className="explore-request-section">
              {typeFilter === "ALL" && buyRows.length > 0 ? (
                <div className="explore-section-head">
                  <h2>빌리기 · 심부름 · 서비스</h2>
                  <span>{otherRequests.length}</span>
                </div>
              ) : null}
              <div className="explore-request-list">
                {otherRequests.map((demand) => (
                  <RequestRow key={demand.id} demand={demand} />
                ))}
              </div>
            </section>
          ) : null}

          {buyRows.length > 0 ? (
            <section className="explore-buy-section">
              {typeFilter === "ALL" && otherRequests.length > 0 ? (
                <div className="explore-section-head">
                  <h2>구매 요청</h2>
                  <span>{totalBuyProducts}</span>
                </div>
              ) : null}
              <div
                className="live-demand-list live-demand-list--discovery"
                aria-busy={remoteLoading}
              >
                {buyRows.map((item) => (
                  <AggregatedDemandCard
                    key={item.id}
                    product={item.product}
                    aggregate={item.aggregate}
                  />
                ))}
              </div>
              {remoteLoading ? <p className="discovery-loading" role="status">요청 불러오는 중…</p> : null}
              {hasMoreBuy ? (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setPage((value) => value + 1)}
                >
                  더 보기
                </Button>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <section className="discovery-create-banner">
        <div>
          <span>원하는 요청이 없나요?</span>
          <strong>필요한 내용을 직접 올려보세요.</strong>
        </div>
        <Button to={createHref} variant="secondary">
          요청 만들기
        </Button>
      </section>
    </div>
  );
}
