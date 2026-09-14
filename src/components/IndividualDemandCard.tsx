import { Link } from "react-router-dom";
import { ko } from "@/copy/ko";
import { formatFulfillmentCardLine } from "@/domain/fulfillment";
import type { Demand } from "@/domain/types";
import { CATEGORY_LABEL, DEMAND_TYPE_LABEL } from "@/domain/types";
import { formatDemandWhen, formatWon } from "@/lib/format";
import "./feedCards.css";

export function IndividualDemandCard({ demand }: { demand: Demand }) {
  const fulfillLine = formatFulfillmentCardLine(demand.fulfillmentOptions);
  const when = formatDemandWhen(demand);
  return (
    <Link to={`/demand/item/${demand.id}`} className="feed-row feed-row--ind">
      <div className="feed-row__meta">
        <span className="feed-row__type">
          {CATEGORY_LABEL[demand.category]} · {DEMAND_TYPE_LABEL[demand.type]}
        </span>
        <h3 className="feed-row__title">{demand.title}</h3>
        <p className="feed-row__place">
          {fulfillLine}
          {when ? ` · ${when}` : null}
          {demand.type === "BORROW" ? ` · ${formatWon(demand.budget)}` : null}
        </p>
      </div>
      <div className="feed-row__stats">
        <div>
          <span>
            {demand.type === "TASK" || demand.type === "SERVICE"
              ? ko.reward
              : demand.type === "BORROW"
                ? ko.borrowBudgetTotal
                : ko.detailBudget}
          </span>
          <strong>{formatWon(demand.budget)}</strong>
        </div>
      </div>
    </Link>
  );
}
