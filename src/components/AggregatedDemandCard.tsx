import { Link } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import type { DemandAggregate, Product } from "@/domain/types";
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
  return (
    <Link to={`/demand/${product.id}`} className="live-demand-card">
      <ProductVisual product={product} size="sm" />
      <div className="live-demand-card__body">
        <div className="live-demand-card__top">
          <h3>{product.name}</h3>
          <span aria-hidden>›</span>
        </div>
        <p className="live-demand-card__signal">
          <strong>구매수요 {aggregate.seekerCount}명</strong>
          <span> · 최근 확인된 수요</span>
        </p>
        {aggregate.fulfillmentSummary ? (
          <p className="live-demand-card__meta">{aggregate.fulfillmentSummary}</p>
        ) : null}
        {price > 0 ? (
          <p className="live-demand-card__price">
            최대 희망가 <strong>{formatWon(price)}</strong>
          </p>
        ) : null}
      </div>
    </Link>
  );
}
