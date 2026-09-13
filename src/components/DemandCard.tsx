import { Link } from "react-router-dom";

import { ko } from "@/copy/ko";
import { CategoryPill, ProductVisual } from "@/components/ProductVisual";
import type { DemandAggregate, Product } from "@/domain/types";
import { formatPriceRange, formatRelativeCount, formatWonShort } from "@/lib/format";
import "@/components/ui/ui.css";
import "./demandCard.css";

type Props = {
  product: Product;
  aggregate: DemandAggregate;
};

export function DemandCard({ product, aggregate }: Props) {
  return (
    <Link to={`/demand/${product.id}`} className="demand-card dan-card dan-card--padded dan-card--interactive">
      <div className="demand-card__signal">
        <p className="demand-card__count">
          <span className="demand-card__count-num">{aggregate.seekerCount}</span>
          <span className="demand-card__count-unit">{ko.myung}</span>
        </p>
        <p className="demand-card__count-label">{ko.seekingOnly}</p>
      </div>

      <div className="demand-card__body">
        <div className="demand-card__row">
          <ProductVisual product={product} size="sm" />
          <div className="demand-card__meta">
            <CategoryPill category={product.category} />
            <h3 className="demand-card__title">{product.name}</h3>
          </div>
        </div>

        <div className="demand-card__stats">
          <div>
            <span className="demand-card__label">{ko.highestHopeShort}</span>
            <strong>{formatWonShort(aggregate.highestIntentPrice)}</strong>
          </div>
          <div>
            <span className="demand-card__label">{ko.priceHope}</span>
            <strong className="demand-card__range">
              {formatPriceRange(aggregate.minPrice, aggregate.maxPrice)}
            </strong>
          </div>
          <div>
            <span className="demand-card__label">{ko.thisWeek}</span>
            <strong className="demand-card__trend">
              {formatRelativeCount(aggregate.recent7dDelta)}
            </strong>
          </div>
        </div>
      </div>
    </Link>
  );
}
