import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { isBuyDemand, type BuyDemand } from "@/domain/types";
import { conditionLabel } from "@/i18n/categories";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

export function DemandDetailPage() {
  const copy = useDanCopy();
  const locale = useDanLocale();
  const { productId = "" } = useParams();
  const { getProduct, getAggregate, myOwnerships, myDemands, currentUser, state } = useDan();
  const [shareStatus, setShareStatus] = useState("");
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
  const activeBuyerDemands = state.demands
    .filter(
      (d): d is BuyDemand =>
        isBuyDemand(d) &&
        d.status === "ACTIVE" &&
        d.details.productId === productId &&
        d.userId !== currentUser?.id,
    )
    .sort((a, b) => b.details.maxPrice - a.details.maxPrice)
    .slice(0, 12);

  async function shareDemand() {
    if (!product) return;
    const shareData = {
      title: copy.detailShareTitle.replace("{name}", product.name),
      text: copy.detailShareText
        .replace("{n}", String(aggregate?.seekerCount ?? 0))
        .replace("{name}", product.name),
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus(copy.detailShareOk);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus(copy.detailShareCopied);
      } else {
        setShareStatus(copy.detailShareManual);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus(copy.detailShareFail);
    }
  }

  useDeepHeader({
    title: product?.name ?? copy.seekingOnly,
    hide: !product,
    right: product ? (
      <button
        type="button"
        className="deep-header-share"
        onClick={() => void shareDemand()}
        aria-label={copy.detailShareAria}
      >
        {copy.detailShare}
      </button>
    ) : undefined,
  });

  if (!product || !aggregate) {
    return (
      <EmptyState
        title={copy.missingDemand}
        body={copy.detailMissingBody}
        action={<Button to="/feed" variant="secondary">{copy.navFeed}</Button>}
      />
    );
  }

  const money = (value: number) => formatStoredMoney(value, "KRW", locale);

  return (
    <div className="page-stack page-narrow detail-page detail-page--blueprint">
      <section className="demand-detail-hero">
        <ProductVisual product={product} size="lg" />
        <div className="demand-detail-copy">
          <span className="eyebrow">{copy.detailSeekingEyebrow}</span>
          <h1>{product.name}</h1>
          <p className="detail-hero__count">
            <strong>
              {aggregate.seekerCount}
              {copy.myung}
            </strong>
            {copy.detailSeekingNow}
          </p>
          <p className="section-desc">{copy.detailBuyLead}</p>
        </div>
      </section>

      {shareStatus ? (
        <p className="share-status" role="status">
          {shareStatus}
        </p>
      ) : null}

      <section className="demand-detail-summary">
        <div>
          <span>{copy.suggestPrice}</span>
          <strong>
            {aggregate.highestIntentPrice > 0
              ? money(aggregate.highestIntentPrice)
              : copy.detailPriceChecking}
          </strong>
        </div>
        <div>
          <span>{copy.detailBuyerFulfillment}</span>
          <strong>{aggregate.fulfillmentSummary || copy.detailFulfillmentChecking}</strong>
        </div>
      </section>

      <section className="detail-section buyer-demand-list">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{copy.detailBuyerRequests}</span>
            <h2>{copy.detailPeopleSeeking}</h2>
          </div>
          <span>
            {activeBuyerDemands.length}
            {copy.detailCountSuffix}
          </span>
        </div>
        {activeBuyerDemands.length > 0 ? (
          <div className="buyer-demand-list__rows">
            {activeBuyerDemands.map((demand, index) => (
              <div key={demand.id} className="buyer-demand-row">
                <div className="buyer-demand-row__main">
                  <span>
                    {copy.detailBuyerDemandN.replace("{n}", String(index + 1))}
                  </span>
                  <strong>
                    {copy.detailMaxPrefix} {money(demand.details.maxPrice)}
                  </strong>
                  <small>
                    {conditionLabel(locale, demand.details.conditionPreference)} ·{" "}
                    {formatFulfillmentSummary(demand.fulfillmentOptions, locale)}
                  </small>
                </div>
                <Button
                  to={`/demand/${product.id}/offer?target=${encodeURIComponent(demand.id)}`}
                  variant="secondary"
                  size="sm"
                >
                  {copy.detailSendOffer}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="section-desc">{copy.detailNoPublicBuyers}</p>
        )}
      </section>

      <section className="seller-action-card">
        <div>
          <span>{copy.haveItTitle}</span>
          <h2>{copy.detailOfferNowTitle}</h2>
          <p>{copy.detailOfferNowBody}</p>
        </div>
        <Button to={`/demand/${product.id}/offer`} fullWidth size="lg">
          {copy.detailSendOfferCta}
        </Button>
        {owned ? <small>{copy.detailReuseOwned}</small> : null}
      </section>

      {myBuy ? (
        <section className="detail-section demand-my-request">
          <div>
            <span>{copy.myRequests}</span>
            <strong>
              {copy.detailMaxPrefix} {money(myBuy.budget)}
            </strong>
          </div>
          <Button to={`/demand/item/${myBuy.id}`} fullWidth variant="secondary">
            {copy.myBuyManage}
          </Button>
        </section>
      ) : (
        <p className="detail-foot">
          {copy.buyerSide}
          <Link to={`/create?type=BUY&q=${encodeURIComponent(product.name)}`}>
            {copy.registerSame}
          </Link>
        </p>
      )}
    </div>
  );
}
