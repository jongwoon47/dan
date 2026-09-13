import { Link, useParams } from "react-router-dom";
import { PriceDistribution } from "@/components/PriceDistribution";
import { ProductVisual, CategoryPill } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatRelativeCount, formatWon, formatWonShort } from "@/lib/format";
import "./pages.css";

export function DemandDetailPage() {
  const { productId = "" } = useParams();
  const { getProduct, getAggregate, myOwnerships } = useDan();
  const product = getProduct(productId);
  const aggregate = getAggregate(productId);
  const owned = myOwnerships.find((o) => o.productId === productId);

  if (!product || !aggregate) {
    return (
      <EmptyState
        title={ko.missingDemand}
        body={ko.detailMissingBody}
        action={<Button to="/feed" variant="secondary">{ko.navFeed}</Button>}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="detail-top">
        <div className="detail-top__identity">
          <CategoryPill category={product.category} />
          <h1 className="page-title">{product.name}</h1>
          <p className="detail-hero__count">
            <strong>
              {aggregate.seekerCount}
              {ko.myung}
            </strong>
            {ko.seekingDetailSuffix.replace(ko.myung, "")}
          </p>
        </div>
        <ProductVisual product={product} size="md" />
      </section>

      <div className="kpi-strip">
        <div className="kpi-strip__item">
          <span>{ko.highestHopeShort}</span>
          <strong>{formatWonShort(aggregate.highestIntentPrice)}</strong>
        </div>
        <div className="kpi-strip__item">
          <span>{ko.avgHope}</span>
          <strong>{formatWonShort(aggregate.avgPrice)}</strong>
        </div>
        <div className="kpi-strip__item">
          <span>{ko.thisWeek}</span>
          <strong className="demand-card__trend">
            {formatRelativeCount(aggregate.recent7dDelta)}
          </strong>
        </div>
      </div>

      {aggregate.fulfillmentSummary ? (
        <p className="section-desc">{aggregate.fulfillmentSummary}</p>
      ) : null}

      <Card className="section-stack">
        <h2 className="section-title">{ko.priceDist}</h2>
        <PriceDistribution buckets={aggregate.priceBuckets} />
      </Card>

      <Card className="holder-cta">
        <h2 className="section-title">{ko.haveItTitle}</h2>
        <p className="section-desc">{ko.haveItBody}</p>
        {owned ? (
          <div className="holder-cta__owned">
            <p>
              {ko.alreadyOwnedPrefix} {ko.seekersLabel}{" "}
              <strong>
                {aggregate.seekerCount}
                {ko.myung}
              </strong>
              .
            </p>
            <Button to={`/ownership/${owned.id}/sell-intent`} fullWidth>
              {ko.leaveSellIntent}
            </Button>
            <Button to="/my" variant="secondary" fullWidth>
              {ko.viewInMy}
            </Button>
          </div>
        ) : (
          <Button to={`/demand/${product.id}/own`} fullWidth size="lg">
            {ko.haveIt}
          </Button>
        )}
        <p className="holder-cta__note">{ko.ownershipNote}</p>
      </Card>

      <p className="detail-foot">
        {ko.buyerSide}
        <Link to="/create">{ko.registerSame}</Link>
      </p>
      <span className="sr-only">{formatWon(aggregate.highestIntentPrice)}</span>
    </div>
  );
}
