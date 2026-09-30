import { useMemo, useState } from "react";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/Input";
import { useDan } from "@/domain/danContext";
import {
  filterAndSortLiveDemand,
  liveDemandCategoryCounts,
  type LiveDemandCategory,
  type LiveDemandSort,
} from "@/domain/liveDemandDiscovery";
import { CATEGORY_LABEL } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

const SORT_OPTIONS: Array<{ value: LiveDemandSort; label: string }> = [
  { value: "popular", label: "인기" },
  { value: "growing", label: "급상승" },
  { value: "price", label: "희망가" },
];

export function DemandFeedPage() {
  const { demandFeed } = useDan();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LiveDemandCategory>("all");
  const [sort, setSort] = useState<LiveDemandSort>("popular");

  const categoryRows = useMemo(
    () => liveDemandCategoryCounts(demandFeed),
    [demandFeed],
  );

  const filtered = useMemo(
    () =>
      filterAndSortLiveDemand(demandFeed, {
        query,
        category,
        sort,
      }),
    [category, demandFeed, query, sort],
  );

  const activeSeekers = filtered.reduce(
    (sum, row) => sum + row.aggregate.seekerCount,
    0,
  );
  const demandHref = query.trim()
    ? `/buy/new?q=${encodeURIComponent(query.trim())}`
    : "/buy/new";

  return (
    <div className="page-stack discovery-page">
      <header className="page-header discovery-header">
        <span className="eyebrow">Live Demand</span>
        <h1 className="page-title">사람들이 지금 찾는 제품</h1>
        <p className="section-desc">
          카메라뿐 아니라 어떤 제품이든 찾을 수 있어요. 원하는 제품이 없으면
          바로 새 구매수요를 만들 수 있습니다.
        </p>
      </header>

      <section className="discovery-panel" aria-label="Live Demand 탐색">
        <div className="discovery-search">
          <span className="discovery-search__icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15 15 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제품, 브랜드, 카테고리 검색"
            aria-label="Live Demand 검색"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className="discovery-search__clear"
              aria-label="검색어 지우기"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="discovery-filter-scroll" aria-label="제품 카테고리">
          <button
            type="button"
            className={category === "all" ? "discovery-chip is-active" : "discovery-chip"}
            onClick={() => setCategory("all")}
          >
            전체
          </button>
          {categoryRows.map(([itemCategory, count]) => (
            <button
              key={itemCategory}
              type="button"
              className={category === itemCategory ? "discovery-chip is-active" : "discovery-chip"}
              onClick={() => setCategory(itemCategory)}
            >
              {CATEGORY_LABEL[itemCategory]} <span>{count}</span>
            </button>
          ))}
        </div>

        <div className="discovery-toolbar">
          <p className="discovery-summary" aria-live="polite">
            <strong>{filtered.length}</strong>개 제품 · <strong>{activeSeekers}</strong>명 구매수요
          </p>
          <div className="discovery-sort" aria-label="정렬">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={sort === option.value ? "is-active" : ""}
                aria-pressed={sort === option.value}
                onClick={() => setSort(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            query.trim()
              ? `‘${query.trim()}’의 Live Demand가 아직 없어요`
              : "조건에 맞는 Live Demand가 없어요"
          }
          body="찾는 사람이 먼저 수요를 남기면, 그 제품을 가진 판매자가 제안할 수 있어요."
          action={
            <Button to={demandHref}>
              {query.trim() ? "이 제품 구매수요 만들기" : "구매수요 등록"}
            </Button>
          }
        />
      ) : (
        <div className="live-demand-list live-demand-list--discovery">
          {filtered.map((item) => (
            <AggregatedDemandCard
              key={item.id}
              product={item.product}
              aggregate={item.aggregate}
            />
          ))}
        </div>
      )}

      <section className="discovery-create-banner">
        <div>
          <span>찾는 제품이 없나요?</span>
          <strong>목록에 없어도 제품명을 직접 입력해 첫 수요를 만들 수 있어요.</strong>
        </div>
        <Button to={demandHref} variant="secondary">
          직접 등록
        </Button>
      </section>
    </div>
  );
}
