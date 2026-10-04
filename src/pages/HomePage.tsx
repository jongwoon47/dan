import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { ProductVisual } from "@/components/ProductVisual";
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

  const heroProducts = useMemo(() => {
    const products = [];
    const seen = new Set<string>();
    const candidates = [
      liveProducts.find(
        (item) => item.kind === "aggregated" && item.product.category === "camera",
      ),
      liveProducts.find(
        (item) =>
          item.kind === "aggregated" &&
          item.product.name.toLocaleLowerCase("en").includes("macbook"),
      ) ??
        liveProducts.find(
          (item) => item.kind === "aggregated" && item.product.category === "computer",
        ) ??
        liveProducts.find(
          (item) => item.kind === "aggregated" && item.product.category === "electronics",
        ),
      liveProducts.find(
        (item) => item.kind === "aggregated" && item.product.category === "furniture",
      ),
    ];

    for (const item of candidates) {
      if (!item || item.kind !== "aggregated" || seen.has(item.product.id)) continue;
      seen.add(item.product.id);
      products.push(item.product);
    }
    return products;
  }, [liveProducts]);

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
      <section className="home-demand-header">
        <div className="home-demand-heading">
          <span className="home-demand-kicker">실시간 수요</span>
          <h1>무엇이<br />필요하세요?</h1>
          <p>구매, 빌리기, 심부름, 서비스까지 필요한 걸 요청해보세요.</p>
        </div>

        <div className="home-hero-products" aria-hidden>
          {heroProducts.map((product, index) => (
            <span key={product.id} className={`home-hero-product home-hero-product--${index + 1}`}>
              <ProductVisual product={product} size="md" />
            </span>
          ))}
        </div>

        <form
          className="home-intent-composer"
          aria-label="찾는 제품 빠른 입력"
          onSubmit={(event) => {
            event.preventDefault();
            const query = intentQuery.trim();
            navigate(query ? `/create?type=BUY&q=${encodeURIComponent(query)}` : "/create?type=BUY");
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
              placeholder="찾는 물건이 있나요?"
              autoComplete="off"
              aria-label="찾는 제품"
            />
            <small>사고 싶은 물건을 바로 요청해보세요</small>
          </label>
          <button type="submit" className="home-intent-composer__submit" aria-label="구매 요청 만들기">
            <span aria-hidden>›</span>
          </button>
        </form>

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

      <section className="home-request-types" aria-label="요청 바로 만들기">
        <div className="home-request-types__head">
          <h2>무엇이 필요하세요?</h2>
          <span>바로 요청을 시작해보세요</span>
        </div>
        <div className="home-request-types__grid">
          <Link to="/create?type=BUY" className="home-request-type">
            <span aria-hidden>🛍️</span><strong>구매</strong><small>사고 싶은 물건</small>
          </Link>
          <Link to="/create?type=BORROW" className="home-request-type">
            <span aria-hidden>📦</span><strong>빌리기</strong><small>잠깐 필요한 물건</small>
          </Link>
          <Link to="/create?type=TASK" className="home-request-type">
            <span aria-hidden>🧭</span><strong>심부름</strong><small>대신 해줄 일</small>
          </Link>
          <Link to="/create?type=SERVICE" className="home-request-type">
            <span aria-hidden>🛠️</span><strong>서비스</strong><small>전문가의 도움</small>
          </Link>
        </div>
      </section>

      <section className="home-live-section">
        <div className="home-live-heading">
          <div>
            <span>실시간 수요</span>
            <h2>지금 올라온 요청</h2>
          </div>
          <Link to="/feed">더보기 <span aria-hidden>›</span></Link>
        </div>
        {visibleProducts.length === 0 ? (
          <EmptyState
            title="아직 이 카테고리의 구매 요청이 없어요"
            body="찾는 제품을 직접 입력해 첫 구매 요청을 남길 수 있어요."
            action={<Button to="/create?type=BUY">구매 요청 만들기</Button>}
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
              <strong>더 많은 요청을 둘러볼까요?</strong>
              <span>구매 요청부터 빌리기·심부름·서비스까지 탐색할 수 있어요.</span>
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
          요청 탐색하기
        </Button>
      </section>
    </div>
  );
}
