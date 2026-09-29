import { Link } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { CATEGORY_LABEL, type DemandAggregate, type Product } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./feedCards.css";

export function AggregatedDemandCard({
  product,
  aggregate,
}: {
  product: Product;
  aggregate: DemandAggregate;
}) {
  const price = aggregate.highestIntentPrice;
  const recentCount = Math.max(
    1,
    Math.min(
      aggregate.seekerCount,
      aggregate.recent7dDelta || aggregate.seekerCount,
    ),
  );
  const subtitle =
    product.brand && product.model && product.model !== product.name
      ? `${product.brand} · ${product.model}`
      : product.brand || CATEGORY_LABEL[product.category];

  return (
    <Link to={`/demand/${product.id}`} className="live-demand-card">
      <ProductVisual product={product} size="sm" />
      <div className="live-demand-card__body">
        <div className="live-demand-card__top">
          <div>
            <h3>{product.name}</h3>
            <span className="live-demand-card__finish">{subtitle}</span>
          </div>
          <span className="live-demand-card__chevron" aria-hidden>›</span>
        </div>
        <p className="live-demand-card__signal">
          <strong>구매수요 {aggregate.seekerCount}명</strong>
        </p>
        <p className="live-demand-card__meta">
          {aggregate.fulfillmentSummary || "거래방식 확인"} · 최근 확인 {recentCount}명
        </p>
        {price > 0 ? (
          <p className="live-demand-card__price">
            최대 희망가 <strong>{formatWon(price)}</strong>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
