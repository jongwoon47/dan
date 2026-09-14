import { Link, useParams } from "react-router-dom";
import { PriceDistribution } from "@/components/PriceDistribution";
import { ProductVisual, CategoryPill } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatRelativeCount, formatWon, formatWonShort } from "@/lib/format";
import "./pages.css";

export function DemandDetailPage() {
  const { productId = "" } = useParams();
  const { getProduct, getAggregate, myOwnerships, myDemands, currentUser } =
    useDan();
  const product = getProduct(productId);
  const aggregate = getAggregate(productId);
  const owned = myOwnerships.find((o) => o.productId === productId);
  const myBuy = myDemands.find(
    (d) =>
      d.type === "BUY" &&
      d.status === "ACTIVE" &&
      d.userId === currentUser?.id &&
      d.details.productId === productId,
  );

  useDeepHeader({
    title: product?.name ?? ko.seekingOnly,
    hide: !product,
  });

  if (!product || !aggregate) {
    return (
      <EmptyState
        title={ko.missingDemand}
        body={ko.detailMissingBody}
        action={<Button to="/feed" variant="secondary">{ko.navFeed}</Button>}
      />
    );
  }

  const showTrend = aggregate.recent7dDelta !== 0;
  const showHighest = aggregate.highestIntentPrice > 0;
  const showAvg = aggregate.avgPrice > 0;

  return (
    <div className="page-stack page-narrow detail-page">
      <section className="detail-top">
        <div className="detail-top__identity">
          <CategoryPill category={product.category} />
          <h1 className="page-title detail-product-title">{product.name}</h1>
          <p className="detail-hero__count">
            {aggregate.seekerCount > 0 ? (
              <>
                <strong>
                  {aggregate.seekerCount}
                  {ko.myung}
                </strong>
                {ko.seekingDetailSuffix.replace(ko.myung, "")}
              </>
            ) : (
              <span className="muted">{ko.emptyFeed}</span>
            )}
          </p>
          <p className="section-desc">{ko.demandFirstLead}</p>
        </div>
        <ProductVisual product={product} size="md" />
      </section>

      {showHighest || showAvg || showTrend ? (
        <div className="kpi-strip kpi-strip--compact">
          {showHighest ? (
            <div className="kpi-strip__item">
              <span>{ko.highestHopeShort}</span>
              <strong>{formatWonShort(aggregate.highestIntentPrice)}</strong>
            </div>
          ) : null}
          {showAvg ? (
            <div className="kpi-strip__item">
              <span>{ko.avgHope}</span>
              <strong>{formatWonShort(aggregate.avgPrice)}</strong>
            </div>
          ) : null}
          {showTrend ? (
            <div className="kpi-strip__item">
              <span>{ko.thisWeek}</span>
              <strong className="demand-card__trend">
                {formatRelativeCount(aggregate.recent7dDelta)}
              </strong>
            </div>
          ) : null}
        </div>
      ) : null}

      {aggregate.fulfillmentSummary ? (
        <section className="detail-section">
          <h2 className="section-title">{ko.tradeMethod}</h2>
          <p className="section-desc">{aggregate.fulfillmentSummary}</p>
        </section>
      ) : null}

      <section className="detail-section">
        <h2 className="section-title">{ko.priceDist}</h2>
        <PriceDistribution
          buckets={aggregate.priceBuckets}
          seekerCount={aggregate.seekerCount}
        />
      </section>

      <section className="holder-cta">
        <h2 className="section-title">{ko.haveItTitle}</h2>
        <p className="section-desc">{ko.haveItBody}</p>
        {owned ? (
          <div className="holder-cta__owned">
            <p>
              {ko.alreadyOwnedPrefix}{" "}
              {aggregate.seekerCount > 0 ? (
                <>
                  {ko.seekersLabel}{" "}
                  <strong>
                    {aggregate.seekerCount}
                    {ko.myung}
                  </strong>
                  .
                </>
              ) : null}
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
      </section>

      {myBuy ? (
        <section className="detail-section">
          <h2 className="section-title">{ko.myBuyManage}</h2>
          <p className="section-desc">
            {ko.maxPrice} {formatWon(myBuy.budget)}
          </p>
          <Button to={`/demand/item/${myBuy.id}`} fullWidth variant="secondary">
            {ko.editDemand} / {ko.closeDemand}
          </Button>
        </section>
      ) : null}

      {myBuy ? null : (
        <p className="detail-foot">
          {ko.buyerSide}
          <Link to="/create?type=BUY">{ko.registerSame}</Link>
        </p>
      )}
    </div>
  );
}
