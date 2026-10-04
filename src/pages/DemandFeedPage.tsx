import { useEffect, useMemo, useState } from "react";
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
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { formatWon } from "@/lib/format";
import {
  filterAndSortLiveDemand,
  liveDemandCategoryCounts,
  type LiveDemandCategory,
  type LiveDemandRow,
  type LiveDemandSort,
} from "@/domain/liveDemandDiscovery";
import { CATEGORY_LABEL, DEMAND_TYPE_LABEL, type DemandType } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

const PAGE_SIZE = 24;

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

export function DemandFeedPage() {
  const { demandFeed, state } = useDan();
  const [query, setQuery] = useState("");
  const [requestType, setRequestType] = useState<"all" | DemandType>("all");
  const [category, setCategory] = useState<LiveDemandCategory>("all");
  const [sort, setSort] = useState<LiveDemandSort>("popular");
  const [page, setPage] = useState(0);
  const [remoteRows, setRemoteRows] = useState<LiveDemandRow[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const productionDiscovery = getDataMode() === "supabase";

  const categoryRows = useMemo(
    () => liveDemandCategoryCounts(demandFeed),
    [demandFeed],
  );

  const localRows = useMemo(
    () =>
      filterAndSortLiveDemand(demandFeed, {
        query,
        category,
        sort,
      }),
    [category, demandFeed, query, sort],
  );

  const directRequests = useMemo(
    () =>
      state.demands
        .filter((demand) => {
          if (demand.type === "BUY") return false;
          if (effectiveDemandStatus(demand) !== "ACTIVE") return false;
          if (requestType !== "all" && demand.type !== requestType) return false;
          const q = query.trim().toLocaleLowerCase("ko");
          if (!q) return true;
          return (
            demand.title.toLocaleLowerCase("ko").includes(q) ||
            (demand.description ?? "").toLocaleLowerCase("ko").includes(q)
          );
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [query, requestType, state.demands],
  );

  const showBuyRequests = requestType === "all" || requestType === "BUY";

  useEffect(() => {
    if (!productionDiscovery) {
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
          if (cancelled) return;
          // Keep the locally hydrated feed as a resilient fallback.
          setRemoteReady(false);
        })
        .finally(() => {
          if (!cancelled) setRemoteLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [category, page, productionDiscovery, query, sort]);

  const filtered =
    productionDiscovery && remoteReady ? remoteRows : localRows;
  const totalProducts =
    productionDiscovery && remoteReady ? remoteTotal : filtered.length;
  const activeSeekers = filtered.reduce(
    (sum, row) => sum + row.aggregate.seekerCount,
    0,
  );
  const hasMore =
    productionDiscovery && remoteReady && filtered.length < remoteTotal;
  const demandHref = query.trim()
    ? `/create?type=BUY&q=${encodeURIComponent(query.trim())}`
    : "/create?type=BUY";
  const createHref =
    requestType === "all"
      ? "/create"
      : requestType === "BUY"
        ? demandHref
        : `/create?type=${requestType}`;

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

  return (
    <div className="page-stack discovery-page">
      <header className="page-header discovery-header">
        <span className="eyebrow">탐색</span>
        <h1 className="page-title">지금 올라온 요청을 찾아보세요</h1>
        <p className="section-desc">
          사람들이 찾는 물건을 둘러보고 바로 제안할 수 있어요.
        </p>
      </header>

      <section className="discovery-panel" aria-label="요청 탐색">
        <div className="request-type-filter" aria-label="요청 유형">
          {(["all", "BUY", "BORROW", "TASK", "SERVICE"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={requestType === value ? "is-active" : ""}
              onClick={() => {
                setRequestType(value);
                setPage(0);
                resetRemoteDiscovery();
              }}
            >
              {value === "all" ? "전체" : DEMAND_TYPE_LABEL[value]}
            </button>
          ))}
        </div>

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
            placeholder="제품이나 브랜드 검색"
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

        {showBuyRequests ? <div className="discovery-filter-scroll" aria-label="제품 카테고리">
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
        </div> : null}

        <div className="discovery-toolbar">
          <p className="discovery-summary" aria-live="polite">
            {showBuyRequests ? (
              <>
                <strong>{totalProducts}</strong>개 제품
                {filtered.length > 0 ? (
                  <> · 현재 <strong>{activeSeekers}</strong>명 찾는 중</>
                ) : null}
              </>
            ) : (
              <><strong>{directRequests.length}</strong>개 요청</>
            )}
          </p>
          {showBuyRequests ? (
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
          ) : null}
        </div>
      </section>

      {directRequests.length > 0 ? (
        <section className="mixed-request-section">
          <div className="mixed-request-list">
            {directRequests.map((demand) => (
              <a key={demand.id} href={`/demand/item/${demand.id}`} className="mixed-request-row">
                <div>
                  <span>{DEMAND_TYPE_LABEL[demand.type]}</span>
                  <strong>{demand.title}</strong>
                  <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
                </div>
                <b>{formatWon(demand.budget)}</b>
                <i aria-hidden>›</i>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {showBuyRequests ? (
        filtered.length === 0 && !remoteLoading ? (
        <EmptyState
          title={
            query.trim()
              ? `‘${query.trim()}’의 요청이 아직 없어요`
              : "조건에 맞는 요청이 없어요"
          }
          body="찾는 사람이 요청을 남기면, 그 물건을 가진 사람이 제안할 수 있어요."
          action={
            <Button to={demandHref}>
              {query.trim() ? "이 제품 요청하기" : "구매 요청하기"}
            </Button>
          }
        />
      ) : (
        <>
          <div
            className="live-demand-list live-demand-list--discovery"
            aria-busy={remoteLoading}
          >
            {filtered.map((item) => (
              <AggregatedDemandCard
                key={item.id}
                product={item.product}
                aggregate={item.aggregate}
              />
            ))}
          </div>
          {remoteLoading ? (
            <p className="discovery-loading" role="status">
              요청 불러오는 중…
            </p>
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
      )
      ) : directRequests.length === 0 ? (
        <EmptyState
          title="조건에 맞는 요청이 없어요"
          body="새 요청을 만들면 필요한 사람과 가능한 사람이 연결될 수 있어요."
          action={<Button to={createHref}>요청 만들기</Button>}
        />
      ) : null}

      <section className="discovery-create-banner">
        <div>
          <span>찾는 요청이 없나요?</span>
          <strong>원하는 제품을 직접 입력해 새 요청을 만들 수 있어요.</strong>
        </div>
        <Button to={createHref} variant="secondary">
          요청 만들기
        </Button>
      </section>
    </div>
  );
}
