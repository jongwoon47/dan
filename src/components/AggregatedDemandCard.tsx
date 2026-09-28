import { Link } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import type { DemandAggregate, Product } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./feedCards.css";

const CAMERA_FINISH: Record<string, string> = {
  "prod-fuji-x100vi": "Black",
  "prod-fuji-x100v": "실버",
  "prod-ricoh-gr3": "Black",
  "prod-ricoh-gr3x": "Black",
  "prod-sony-rx100m7": "Black",
};

export function AggregatedDemandCard({ product, aggregate }: { product: Product; aggregate: DemandAggregate; }) {
  const price = aggregate.highestIntentPrice;
  const recentCount = Math.max(1, Math.min(aggregate.seekerCount, aggregate.recent7dDelta || aggregate.seekerCount));
  const finish = CAMERA_FINISH[product.id];

  return (
    <Link to={`/demand/${product.id}`} className="live-demand-card">
      <ProductVisual product={product} size="sm" />
      <div className="live-demand-card__body">
        <div className="live-demand-card__top">
          <div>
            <h3>{product.name}</h3>
            {finish ? <span className="live-demand-card__finish">{finish}</span> : null}
          </div>
          <span className="live-demand-card__chevron" aria-hidden>›</span>
        </div>
        <p className="live-demand-card__signal"><strong>구매수요 {aggregate.seekerCount}명</strong></p>
        <p className="live-demand-card__meta">{aggregate.fulfillmentSummary || "서울 · 직거래"} · 최근 확인 {recentCount}명</p>
        {price > 0 ? <p className="live-demand-card__price">최대 희망가 <strong>{formatWon(price)}</strong></p> : null}
      </div>
    </Link>
  );
}
