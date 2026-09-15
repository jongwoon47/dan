import { Link } from "react-router-dom";
import { ko } from "@/copy/ko";
import { primaryPublicPlace } from "@/domain/fulfillment";
import type { Demand } from "@/domain/types";
import { DEMAND_TYPE_LABEL } from "@/domain/types";
import { formatDemandWhen, formatWon } from "@/lib/format";
import {
  formatPublicPlaceLine,
  loadViewerGeo,
} from "@/lib/geoDistance";
import "./feedCards.css";

function feedPlaceLine(demand: Demand): string {
  const place = primaryPublicPlace(demand.fulfillmentOptions);
  if (place) {
    return formatPublicPlaceLine(place, loadViewerGeo());
  }
  const remote = demand.fulfillmentOptions.some((o) => o.mode === "REMOTE");
  const shipping = demand.fulfillmentOptions.some((o) => o.mode === "SHIPPING");
  if (remote) return ko.fulfillRemote;
  if (shipping) return ko.fulfillShippingShort;
  return "";
}

export function IndividualDemandCard({ demand }: { demand: Demand }) {
  const placeLine = feedPlaceLine(demand);
  const when = formatDemandWhen(demand);
  const meta = [placeLine, when].filter(Boolean).join(" · ");
  const showPrice = demand.budget > 0;
  const priceLabel =
    demand.type === "TASK" || demand.type === "SERVICE"
      ? ko.reward
      : demand.type === "BORROW"
        ? ko.borrowBudgetTotal
        : ko.detailBudget;

  return (
    <Link to={`/demand/item/${demand.id}`} className="feed-row feed-row--ind">
      <div className="feed-row__meta">
        <span className="feed-row__type">{DEMAND_TYPE_LABEL[demand.type]}</span>
        <h3 className="feed-row__title">{demand.title}</h3>
        {meta ? <p className="feed-row__place">{meta}</p> : null}
      </div>
      {showPrice ? (
        <div className="feed-row__stats">
          <div>
            <span>{priceLabel}</span>
            <strong>{formatWon(demand.budget)}</strong>
          </div>
        </div>
      ) : null}
    </Link>
  );
}
