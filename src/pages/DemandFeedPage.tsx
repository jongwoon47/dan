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
import {
  filterAndSortLiveDemand,
  liveDemandCategoryCounts,
  type LiveDemandCategory,
  type LiveDemandRow,
  type LiveDemandSort,
} from "@/domain/liveDemandDiscovery";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import {
  CATEGORY_LABEL,
  DEMAND_TYPE_LABEL,
  type Demand,
  type DemandType,
} from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";
import "@/components/feedCards.css";

const PAGE_SIZE = 24;

type RequestFilter = "all" | DemandType;

const TYPE_FILTERS: Array<{ value: RequestFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "BUY", label: "구매" },
  { value: "BORROW", label: "빌리기" },
  { value: "TASK", label: "심부름" },
  { value: "SERVICE", label: "서비스" },
];

const SORT_OPTIONS: Array<{ value: LiveDemandSort; label: string }> = [
  { value: "popular", label: "인기" },
  { value: "growing", label: "급상승" },
  { value: "price", label: "가격" },
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

function requestAmount(demand: Demand): number {
  return demand.type === "BUY" ? demand.details.maxPrice : demand.budget;
}

function GenericRequestRow({ demand }: { demand: Demand }) {
  return (
    <Link to={`/demand/item/${demand.id}`} className="explore-request-row">
      <span className="explore-request-row__type">{DEMAND_TYPE_LABEL[demand.type]}</span>
      <div className="explore-request-row__body">
        <div>
          <strong>{demand.title}</strong>
          <b>{formatWon(requestAmount(demand))}</b>
        </div>
        <p>{formatFulfillmentSummary(demand.fulfillmentOptions)}</p>
        {demand.description && demand.description !== demand.title ? (
          <small>{demand.description}</small>
        ) : null}
      </div>
      <span className="explore-request-row__arrow" aria-hidden>›</span>
    </Link>
  );
}

export function DemandFeedPage() {
  const { demandFeed } = useDan();
  const [query, setQuery] = useState("");
  const [requestType, setRequestType] = useState<RequestFilter>("all");
  const [category, setCategory] = useState<LiveDemandCategory>("all");
  const [sort, setSort] = useState<LiveDemandSort>("popular");
  const [page, setPage] = useState(0);
  const [remoteRows, setRemoteRows] = useState<LiveDemandRow[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const productionDiscovery = getDataMode() === "supabase";
  const showBuy = requestType === "all" || requestType === "BUY";

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

  const individualRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ko");
    return demandFeed
      .filter((item) => item.kind === "individual")
      .map((item) => item.kind === "individual" ? item.demand : null)
      .filter((demand): demand is Demand => Boolean(demand))
      .filter((demand) => demand.type !== "BUY")
      .filter((demand) => requestType === "all" || demand.type === requestType)
      .filter((demand) => {
        if (!q) return true;
        return `${demand.title} ${demand.description}`.toLocaleLowerCase("ko").includes(q);
      })
      .filter((demand) => demand.status === "ACTIVE" || demand.status === "MATCHED")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [demandFeed, query, requestType]);

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

  const buyRows =
    showBuy
      ? productionDiscovery && remoteReady
        ? remoteRows
        : localBuyRows
      : [];

  const totalProducts =
    productionDiscovery && remoteReady && showBuy ? remoteTotal : buyRows.length;
  const hasMore =
    showBuy && productionDiscovery && remoteReady && buyRows.length < remoteTotal;

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

  function updateType(value: RequestFilter) {
    resetRemoteDiscovery();
    setRequestType(value);
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

  const empty = buyRows.length === 0 && individualRows.length === 0 && !remoteLoading;

  return (
    <div className="page-stack discovery-page discovery-page--app">
      <header className="page-header discovery-header">
        <span className="eyebrow">탐색</span>
        <h1 className="page-title">지금 필요한 사람들</h1>
        <p className="section-desc">물건부터 심부름과 서비스까지, 가능한 요청에 바로 제안해보세요.</p>
      </header>

      <section className="discovery-panel" aria-label="요청 탐색">
        <div className="discovery-search">
          <span className="discovery-search__icon" aria-hidden>⌕</span>
          <TextInput
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="무엇을 찾고 있나요?"
            aria-label="요청 검색"
            autoComplete="off"
          />
          {query ? (
            <button type="button" className="discovery-search__clear" aria-label="검색어 지우기" onClick={() => updateQuery("")}>×</button>
          ) : null}
        </div>

        <div className="app-type-filter" aria-label="요청 유형">
          {TYPE_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={requestType === item.value ? "is-active" : ""}
              onClick={() => updateType(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {showBuy ? (
          <div className="discovery-filter-scroll" aria-label="제품 카테고리">
            <button type="button" className={category === "all" ? "discovery-chip is-active" : "discovery-chip"} onClick={() => updateCategory("all")}>전체 제품</button>
            {categoryRows.map(([itemCategory, count]) => (
              <button key={itemCategory} type="button" className={category === itemCategory ? "discovery-chip is-active" : "discovery-chip"} onClick={() => updateCategory(itemCategory)}>
                {CATEGORY_LABEL[itemCategory]} <span>{count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {showBuy ? (
          <div className="discovery-toolbar">
            <p className="discovery-summary"><strong>{totalProducts}</strong>개 제품</p>
            <div className="discovery-sort" aria-label="정렬">
              {SORT_OPTIONS.map((option) => (
                <button key={option.value} type="button" className={sort === option.value ? "is-active" : ""} aria-pressed={sort === option.value} onClick={() => updateSort(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {empty ? (
        <EmptyState
          title="조건에 맞는 요청이 아직 없어요"
          body="필요한 것을 직접 요청하면 가능한 사람이 제안할 수 있어요."
          action={<Button to={requestType === "all" ? "/create" : `/create?type=${requestType}`}>요청 만들기</Button>}
        />
      ) : (
        <>
          {buyRows.length > 0 ? (
            <section className="explore-section">
              {requestType === "all" ? <div className="app-section-head"><h2>구매 요청</h2><span>가격을 걸고 찾는 물건이에요</span></div> : null}
              <div className="live-demand-list live-demand-list--discovery" aria-busy={remoteLoading}>
                {buyRows.map((item) => (
                  <AggregatedDemandCard key={item.id} product={item.product} aggregate={item.aggregate} />
                ))}
              </div>
            </section>
          ) : null}

          {individualRows.length > 0 ? (
            <section className="explore-section">
              {requestType === "all" ? <div className="app-section-head"><h2>다른 요청</h2><span>빌리기·심부름·서비스 요청이에요</span></div> : null}
              <div className="explore-request-list">
                {individualRows.map((demand) => <GenericRequestRow key={demand.id} demand={demand} />)}
              </div>
            </section>
          ) : null}

          {remoteLoading ? <p className="discovery-loading" role="status">요청 불러오는 중…</p> : null}
          {hasMore ? <Button variant="secondary" fullWidth onClick={() => setPage((value) => value + 1)}>더 보기</Button> : null}
        </>
      )}

      <section className="discovery-create-banner">
        <div>
          <span>원하는 요청이 없나요?</span>
          <strong>필요한 걸 먼저 올리면 가능한 사람이 제안할 수 있어요.</strong>
        </div>
        <Button to="/create" variant="secondary">요청 만들기</Button>
      </section>
    </div>
  );
}
