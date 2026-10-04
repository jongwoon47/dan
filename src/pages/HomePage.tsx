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
    .slice(0, 4);

  return (
    <div className="page-stack home-page home-page--v1">
      <section className="home-demand-header home-demand-header--app">
        <div className="home-demand-heading">
          <span className="home-demand-kicker">DAN</span>
          <h1>무엇이 필요하세요?</h1>
          <p>찾는 물건부터 빌리기, 심부름, 서비스까지 먼저 요청해보세요.</p>
        </div>

        <form
          className="home-intent-composer"
          aria-label="찾는 물건 빠른 입력"
          onSubmit={(event) => {
            event.preventDefault();
            const query = intentQuery.trim();
            navigate(query ? `/create?type=BUY&q=${encodeURIComponent(query)}` : "/create");
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
              placeholder="무엇을 찾고 있나요?"
              autoComplete="off"
              aria-label="찾는 제품"
            />
            <small>찾는 물건을 바로 요청할 수 있어요</small>
          </label>
          <button type="submit" className="home-intent-composer__submit" aria-label="요청 만들기">
            <span aria-hidden>›</span>
          </button>
        </form>

        <div className="home-request-types" aria-label="요청 유형">
          <Link to="/create?type=BUY">구매</Link>
          <Link to="/create?type=BORROW">빌리기</Link>
          <Link to="/create?type=TASK">심부름</Link>
          <Link to="/create?type=SERVICE">서비스</Link>
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
        <div className="home-live-heading">
          <div>
            <span>지금 올라온 요청</span>
            <h2>찾는 사람이 많은 물건</h2>
          </div>
          <Link to="/feed">더보기 <span aria-hidden>›</span></Link>
        </div>
        {visibleProducts.length === 0 ? (
          <EmptyState
            title="아직 이 카테고리의 요청이 없어요"
            body="찾는 물건을 직접 입력해 첫 요청을 올릴 수 있어요."
            action={<Button to="/create?type=BUY">구매 요청 올리기</Button>}
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
              <strong>더 많은 수요를 둘러볼까요?</strong>
              <span>전체 요청을 검색하고 카테고리별로 둘러볼 수 있어요.</span>
            </div>
            <Button to="/feed" variant="secondary">
              전체 탐색
            </Button>
          </div>
        ) : null}
      </section>

      <section className="seller-entry-banner">
        <div>
          <span>가지고 있는 물건이 보이나요?</span>
          <strong>판매글을 새로 만들지 않고 원하는 사람에게 바로 제안할 수 있어요.</strong>
        </div>
        <Button to="/feed" variant="secondary">
          전체 요청 둘러보기
        </Button>
      </section>
    </div>
  );
}
