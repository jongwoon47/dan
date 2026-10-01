import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDan } from "@/domain/danContext";
import { CATEGORY_LABEL, type ProductCategory } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

type HomeCategory = "all" | ProductCategory;

export function HomePage() {
  const { demandFeed } = useDan();
  const navigate = useNavigate();
  const [category, setCategory] = useState<HomeCategory>("all");
  const [intentQuery, setIntentQuery] = useState("");

  const liveProducts = useMemo(
    () =>
      demandFeed
        .filter(
          (item) =>
            item.kind === "aggregated" &&
            item.aggregate.seekerCount > 0,
        )
        .sort((a, b) => {
          if (a.kind !== "aggregated" || b.kind !== "aggregated") return 0;
          return (
            b.aggregate.seekerCount - a.aggregate.seekerCount ||
            b.aggregate.recent7dDelta - a.aggregate.recent7dDelta ||
            b.aggregate.highestIntentPrice - a.aggregate.highestIntentPrice
          );
        }),
    [demandFeed],
  );

  const categoryRows = useMemo(() => {
    const counts = new Map<ProductCategory, number>();
    for (const item of liveProducts) {
      if (item.kind !== "aggregated") continue;
      counts.set(
        item.product.category,
        (counts.get(item.product.category) ?? 0) + item.aggregate.seekerCount,
      );
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [liveProducts]);

  const totalDemand = liveProducts.reduce(
    (sum, item) =>
      sum + (item.kind === "aggregated" ? item.aggregate.seekerCount : 0),
    0,
  );

  const visibleProducts = liveProducts
    .filter(
      (item) =>
        category === "all" ||
        (item.kind === "aggregated" && item.product.category === category),
    )
    .slice(0, 6);

  return (
    <div className="page-stack home-page home-page--v1">
      <section className="home-demand-header">
        <div className="home-demand-heading">
          <h1>지금 사고 있는 사람들</h1>
          <p>
            찾는 사람이 먼저 올려두면,
            <br />
            그 물건을 가진 사람이 판매를 제안해요.
          </p>
        </div>

        <form
          className="home-intent-composer"
          aria-label="찾는 제품 빠른 입력"
          onSubmit={(event) => {
            event.preventDefault();
            const query = intentQuery.trim();
            navigate(query ? `/buy/new?q=${encodeURIComponent(query)}` : "/buy/new");
          }}
        >
          <span className="home-intent-composer__icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15 15 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <label className="home-intent-composer__copy">
            <span className="sr-only">찾는 제품</span>
            <input
              value={intentQuery}
              onChange={(event) => setIntentQuery(event.target.value)}
              placeholder="어떤 제품을 찾고 있나요?"
              autoComplete="off"
              aria-label="찾는 제품"
            />
            <small>없어도 괜찮아요 · 바로 새 구매수요를 만들 수 있어요</small>
          </label>
          <button type="submit" className="home-intent-composer__submit" aria-label="구매수요 만들기">
            <span aria-hidden>›</span>
          </button>
        </form>

        <div className="home-demand-tabs" role="tablist" aria-label="구매수요 보기">
          <Link to="/" className="home-demand-tab is-active" aria-current="page">
            Live Demand
          </Link>
          <Link to="/my" className="home-demand-tab">
            내 구매수요
          </Link>
        </div>

        <div className="home-demand-filters" aria-label="제품 카테고리">
          <button
            type="button"
            className={category === "all" ? "demand-filter is-active" : "demand-filter"}
            onClick={() => setCategory("all")}
          >
            전체 {totalDemand}
          </button>
          {categoryRows.map(([itemCategory, count]) => (
            <button
              key={itemCategory}
              type="button"
              className={category === itemCategory ? "demand-filter is-active" : "demand-filter"}
              onClick={() => setCategory(itemCategory)}
            >
              {CATEGORY_LABEL[itemCategory]} {count}
            </button>
          ))}
        </div>
      </section>

      <section className="home-live-section">
        {visibleProducts.length === 0 ? (
          <EmptyState
            title="아직 이 카테고리의 구매수요가 없어요"
            body="찾는 제품을 직접 입력해 첫 구매수요를 남길 수 있어요."
            action={<Button to="/buy/new">구매수요 등록</Button>}
          />
        ) : (
          <div className="live-demand-list">
            {visibleProducts.map((item) =>
              item.kind === "aggregated" ? (
                <AggregatedDemandCard
                  key={item.id}
                  product={item.product}
                  aggregate={item.aggregate}
                />
              ) : null,
            )}
          </div>
        )}
        {visibleProducts.length > 0 ? (
          <div className="home-live-footer">
            <div>
              <strong>더 많은 제품을 찾고 있나요?</strong>
              <span>전체 Live Demand에서 검색·카테고리·급상승 순으로 탐색할 수 있어요.</span>
            </div>
            <Button to="/feed" variant="secondary">
              전체 탐색
            </Button>
          </div>
        ) : null}
      </section>

      <section className="seller-entry-banner">
        <div>
          <span>이 중 가지고 있는 물건이 있나요?</span>
          <strong>판매글을 먼저 만들 필요 없이, 실제 구매수요에 바로 제안할 수 있어요.</strong>
        </div>
        <Button to="/feed" variant="secondary">
          전체 Live Demand 보기
        </Button>
      </section>
    </div>
  );
}
