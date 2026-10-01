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
  const growth = Math.max(0, aggregate.recent7dDelta);
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
            <div className="live-demand-card__eyebrow">
              <span>{CATEGORY_LABEL[product.category]}</span>
              {growth > 0 ? <strong>7일 +{growth}</strong> : null}
            </div>
            <h3>{product.name}</h3>
            <span className="live-demand-card__finish">{subtitle}</span>
          </div>
          <span className="live-demand-card__favorite" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M20.8 8.7c0 5.4-8.8 10.2-8.8 10.2S3.2 14.1 3.2 8.7A4.5 4.5 0 0 1 12 7.3a4.5 4.5 0 0 1 8.8 1.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </span>
        </div>

        <div className="live-demand-card__signals">
          <span className="live-demand-card__demand">
            <strong>{aggregate.seekerCount}</strong>명 찾는 중
          </span>
          <span>{aggregate.fulfillmentSummary || "거래방식 확인"}</span>
          <span>최근 확인 {recentCount}명</span>
        </div>

        {price > 0 ? (
          <p className="live-demand-card__price">
            최대 희망가 <strong>{formatWon(price)}</strong>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
