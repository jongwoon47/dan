import { Link } from "react-router-dom";
import { ko } from "@/copy/ko";
import type { DemandAggregate, Product } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./feedCards.css";

export function AggregatedDemandCard({
  product,
  aggregate,
}: {
  product: Product;
  aggregate: DemandAggregate;
}) {
  return (
    <Link to={`/demand/${product.id}`} className="feed-row feed-row--agg">
      <div className="feed-row__meta">
        <span className="feed-row__type">
          {CATEGORY_LABEL[product.category]} · {ko.typeBuy}
        </span>
        <h3 className="feed-row__title">{product.name}</h3>
        <p className="feed-row__signal">
          <strong>
            {aggregate.seekerCount}
            {ko.myung}
          </strong>
          {ko.similarSeeking}
        </p>
      </div>
      <div className="feed-row__stats">
        <div>
          <span>{ko.maxBudget}</span>
          <strong>{formatWon(aggregate.highestIntentPrice)}</strong>
        </div>
        <div>
          <span>{ko.thisWeek}</span>
          <strong className="feed-row__trend">
            +{aggregate.recent7dDelta}
            {ko.myung}
          </strong>
        </div>
      </div>
    </Link>
  );
}
