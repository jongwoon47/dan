import { Link } from "react-router-dom";
import { ko } from "@/copy/ko";
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
    <Link to={`/demand/${product.id}`} className="feed-row feed-row--agg">
      <div className="feed-row__meta">
        <span className="feed-row__type">{ko.typeBuy}</span>
        <h3 className="feed-row__title">{product.name}</h3>
        {aggregate.seekerCount > 0 ? (
          <p className="feed-row__signal">
            <strong>
              {aggregate.seekerCount}
              {ko.myung}
            </strong>
            {ko.similarSeeking}
          </p>
        ) : null}
        {aggregate.fulfillmentSummary ? (
          <p className="feed-row__place">{aggregate.fulfillmentSummary}</p>
        ) : null}
      </div>
      <div className="feed-row__stats">
        {price > 0 ? (
          <div>
            <span>{ko.maxBudget}</span>
            <strong>{formatWon(price)}</strong>
          </div>
        ) : null}
        {aggregate.recent7dDelta > 0 ? (
          <div>
            <span>{ko.thisWeek}</span>
            <strong className="feed-row__trend">
              +{aggregate.recent7dDelta}
              {ko.myung}
            </strong>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
