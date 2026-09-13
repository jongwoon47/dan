import { Link } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { IndividualDemandCard } from "@/components/IndividualDemandCard";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { DemandType } from "@/domain/types";
import { DEMAND_TYPE_LABEL } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

const TYPES: DemandType[] = ["BUY", "BORROW", "TASK", "SERVICE"];

export function HomePage() {
  const { demandFeed } = useDan();
  const featured = demandFeed.slice(0, 8);

  return (
    <div className="page-stack home-page">
      <section className="composer">
        <h1 className="composer__title">{ko.composerTitle}</h1>
        <p className="composer__hint">{ko.composerHint}</p>
        <Link to="/create" className="composer__box">
          {ko.composerPlaceholder}
        </Link>
        <div className="type-row" aria-label="demand types">
          {TYPES.map((type) => (
            <Link key={type} to={`/create?type=${type}`} className="type-chip">
              {DEMAND_TYPE_LABEL[type]}
            </Link>
          ))}
        </div>
      </section>

      <section className="section-stack">
        <div className="section-head">
          <h2 className="section-title">{ko.feedNowTitle}</h2>
          <p className="section-desc">{ko.feedNowDesc}</p>
        </div>
        <div className="feed-list">
          {featured.map((item) =>
            item.kind === "aggregated" ? (
              <AggregatedDemandCard
                key={item.id}
                product={item.product}
                aggregate={item.aggregate}
              />
            ) : (
              <IndividualDemandCard key={item.id} demand={item.demand} />
            ),
          )}
        </div>
        <Link to="/feed" className="text-link">
          {ko.viewAllDemand}
        </Link>
      </section>
    </div>
  );
}
