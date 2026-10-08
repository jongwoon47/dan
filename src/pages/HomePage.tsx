import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { IndividualDemandCard } from "@/components/IndividualDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDan } from "@/domain/danContext";
import { translate, useDanLocale } from "@/i18n/locale";
import { categoryLabel } from "@/i18n/categories";
import { useSavedAreas } from "@/lib/savedAreas";
import { type ProductCategory } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

type HomeCategory = "all" | ProductCategory;

export function HomePage() {
  const locale = useDanLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const savedAreas = useSavedAreas();
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
      if (item.kind !== "aggregated" || item.product.category === "other") continue;
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

  const recentIndividualRequests = demandFeed
    .filter((item) => item.kind === "individual")
    .slice(0, 4);

  return (
    <div className="page-stack home-page home-page--v1">
      <section className="home-demand-header home-demand-header--app">
        <div className="home-demand-heading">
          <span className="home-demand-kicker">DAN</span>
          <h1>{t("whatNeed")}</h1>
          <p>{t("homeLead")}</p>
        </div>

        <form
          className="home-intent-composer"
          aria-label={t("requestSearch")}
          onSubmit={(event) => {
            event.preventDefault();
            const query = intentQuery.trim();
            navigate(query ? `/feed?q=${encodeURIComponent(query)}` : "/feed");
          }}
        >
          <span className="home-intent-composer__icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" strokeWidth="1.8" />
              <path d="m15 15 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <label className="home-intent-composer__copy">
            <span className="sr-only">요청 검색</span>
            <input
              value={intentQuery}
              onChange={(event) => setIntentQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              autoComplete="off"
              aria-label={t("requestSearch")}
            />
            <small>{t("homeLead")}</small>
          </label>
          <button type="submit" className="home-intent-composer__submit" aria-label={t("requestSearch")}>
            <span aria-hidden>›</span>
          </button>
        </form>

        <div className="home-request-types" aria-label="요청 유형">
          <Link to="/create?type=BUY">{t("buy")}</Link>
          <Link to="/create?type=BORROW">{t("borrow")}</Link>
          <Link to="/create?type=TASK">{t("task")}</Link>
          <Link to="/create?type=SERVICE">{t("service")}</Link>
        </div>

        {savedAreas.length > 0 ? (
          <div className="home-saved-areas" aria-label={t("savedAreas")}>
            <strong>{t("savedAreas")}</strong>
            <div className="home-saved-areas__links">
              {savedAreas.map((area) => (
                <Link key={area.country + area.label} to={`/feed?area=${encodeURIComponent(area.label)}&country=${area.country}`}>
                  {area.country === "JP" ? "JP" : "KR"} · {area.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="home-demand-filters" aria-label="제품 카테고리">
          <button
            type="button"
            className={category === "all" ? "demand-filter is-active" : "demand-filter"}
            onClick={() => setCategory("all")}
          >
            {t("all")} {totalDemand}
          </button>
          {categoryRows.map(([itemCategory, count]) => (
            <button
              key={itemCategory}
              type="button"
              className={category === itemCategory ? "demand-filter is-active" : "demand-filter"}
              onClick={() => setCategory(itemCategory)}
            >
              {categoryLabel(locale, itemCategory)} {count}
            </button>
          ))}
        </div>
      </section>

      <section className="home-live-section">
        <div className="home-live-heading">
          <div>
            <span>{t("openRequests")}</span>
            <h2>{t("popularThings")}</h2>
          </div>
          <Link to="/feed">{t("more")} <span aria-hidden>›</span></Link>
        </div>
        {visibleProducts.length === 0 ? (
          <EmptyState
            title={t("noProducts")}
            body={t("noProductsDetail")}
            action={<Button to="/create?type=BUY">{t("createRequest")}</Button>}
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

      {recentIndividualRequests.length > 0 ? (
        <section className="home-live-section home-individual-section">
          <div className="home-live-heading">
            <div>
              <span>{t("borrow")} · {t("task")} · {t("service")}</span>
              <h2>{t("recentRequests")}</h2>
            </div>
            <Link to="/feed">{t("browseAll")} <span aria-hidden>›</span></Link>
          </div>
          <div className="mixed-demand-list home-mixed-request-list">
            {recentIndividualRequests.map((item) =>
              item.kind === "individual" ? (
                <IndividualDemandCard key={item.id} demand={item.demand} />
              ) : null,
            )}
          </div>
        </section>
      ) : null}

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
