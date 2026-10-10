import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { fillCopyTemplate } from "@/copy/dealChain";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import { parsePotentialMatchId } from "@/domain/matchLifecycle";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import type { PublicProfile } from "@/domain/types";
import { conditionLabel, tradeLabel } from "@/i18n/categories";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

export function OfferDetailPage() {
  const locale = useDanLocale();
  const copy = useDanCopy();
  const numberLocale = locale === "ja" ? "ja-JP" : "ko-KR";
  const { matchId = "" } = useParams();
  const {
    myMatches,
    state,
    currentUser,
    getProduct,
    getDemand,
    getPublicProfile,
    expressBuyerInterest,
  } = useDan();
  const [sellerProfile, setSellerProfile] = useState<PublicProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pair = parsePotentialMatchId(matchId);
  const match = myMatches.find((row) => row.id === matchId) ??
    (pair ? myMatches.find((row) =>
      row.demandId === pair.demandId && row.sellIntentId === pair.sellIntentId,
    ) : undefined);
  const demand = match ? getDemand(match.demandId) : undefined;
  const sell = match?.sellIntentId
    ? state.sellIntents.find((row) => row.id === match.sellIntentId)
    : undefined;
  const ownership = sell
    ? state.ownerships.find((row) => row.id === sell.ownershipId)
    : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const isBuyer = Boolean(match && currentUser?.id === match.buyerId);

  useDeepHeader({ title: copy.offerDetailTitle });

  useEffect(() => {
    if (!match?.sellerId) return;
    let cancelled = false;
    void getPublicProfile(match.sellerId).then((profile) => {
      if (!cancelled) setSellerProfile(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [getPublicProfile, match?.sellerId]);

  if (!match || !demand || !sell || !ownership || !product || !currentUser || !isBuyer) {
    return (
      <EmptyState
        title={copy.offerMissingTitle}
        body={copy.offerMissingBody}
        action={<Button to="/my">{copy.receivedOffers}</Button>}
      />
    );
  }

  const completedTrades = sellerProfile?.completedDemandCount ?? 0;
  const issueTrades =
    (sellerProfile?.sellerFaultCancellationCount ?? 0) +
    (sellerProfile?.unresolvedDisputeCount ?? 0);

  const usageValue =
    sell.approxUsageCount == null
      ? null
      : product.category === "camera"
        ? fillCopyTemplate(copy.dealShutterCountValue, {
            n: sell.approxUsageCount.toLocaleString(numberLocale),
          })
        : sell.approxUsageCount.toLocaleString(numberLocale);
  const money = (value: number) =>
    formatStoredMoney(value, demand.currencyCode ?? "KRW", locale);

  async function interest() {
    if (busy) return;
    const activeMatch = match;
    if (!activeMatch) return;
    setBusy(true);
    setError("");
    try {
      const updated = await expressBuyerInterest(activeMatch.id);
      if (!updated) {
        setError(copy.genericError);
      }
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack page-narrow offer-detail-page">
      <section className={sell.quickPhotoUrl ? "offer-detail-product offer-detail-product--photo" : "offer-detail-product offer-detail-product--catalog"}>
        {sell.quickPhotoUrl ? (
          <img
            className="offer-detail-product__photo"
            src={sell.quickPhotoUrl}
            alt={fillCopyTemplate(copy.sellerPhotoAlt, { name: product.name })}
          />
        ) : (
          <ProductVisual product={product} size="sm" />
        )}
        <div>
          <p className="eyebrow">{copy.quickOfferEyebrow}</p>
          <h1 className="page-title">{product.name}</h1>
          <strong className="offer-detail-price">{money(sell.minimumPrice)}</strong>
        </div>
      </section>

      <section className="offer-detail-facts">
        {usageValue ? (
          <div>
            <span>
              {product.category === "camera" ? copy.dealShutterCount : copy.dealUsageCount}
            </span>
            <strong>{usageValue}</strong>
          </div>
        ) : null}
        <div>
          <span>{copy.condition}</span>
          <strong>{conditionLabel(locale, ownership.condition)}</strong>
        </div>
        <div>
          <span>{copy.conditionNoteLabel}</span>
          <strong>{sell.conditionNote || copy.noSpecialNotes}</strong>
        </div>
        <div>
          <span>{copy.buyerHopeFulfillment}</span>
          <strong>{formatFulfillmentSummary(demand.fulfillmentOptions, locale)}</strong>
        </div>
        <div>
          <span>{copy.sellerCanFulfill}</span>
          <strong>
            {!sell.tradeMethod
              ? "—"
              : sell.tradeMethod === "any"
                ? copy.tradeMeetupOrShipping
                : tradeLabel(locale, sell.tradeMethod)}
          </strong>
        </div>
      </section>

      <section className="offer-seller-card">
        <div className="offer-seller-card__head">
          <div>
            <span>{copy.sellerLabel}</span>
            <strong>{sellerProfile?.displayName || copy.sellerLabel}</strong>
          </div>
          {sellerProfile?.identityVerified ? (
            <span className="trust-verified-badge">{copy.identityVerified}</span>
          ) : null}
        </div>
        <div className="offer-seller-card__facts">
          <div>
            <strong>{completedTrades}</strong>
            <span>{copy.completedTradesLabel}</span>
          </div>
          <div>
            <strong>{issueTrades === 0 ? copy.dealNone : issueTrades}</strong>
            <span>{copy.issueTradesLabel}</span>
          </div>
        </div>
        <Button to={"/profile/" + match.sellerId} variant="ghost" fullWidth>
          {copy.viewTradeHistory}
        </Button>
      </section>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {match.status === "POTENTIAL" ? (
        <Button fullWidth size="lg" disabled={busy} onClick={() => void interest()}>
          {busy ? copy.processing : copy.selectThisOffer}
        </Button>
      ) : match.status === "BUYER_INTERESTED" ? (
        <section className="offer-next-state">
          <strong>{copy.offerSelectedTitle}</strong>
          <p>{copy.offerSelectedBody}</p>
          <Button to="/my" variant="secondary" fullWidth>
            {copy.backToReceivedOffers}
          </Button>
        </section>
      ) : match.status === "CONNECTED" ? (
        <section className="offer-next-state">
          <strong>{copy.connectedWithSeller}</strong>
          <p>{copy.connectedWithSellerBody}</p>
          <Button to={"/match/" + match.id} fullWidth size="lg">
            {copy.startChat}
          </Button>
          {match.dealStage === "EVIDENCE_READY" ||
          match.dealStage === "DEAL_REVIEW" ||
          match.dealStage === "DEAL_LOCKED" ? (
            <Button to={"/deal/" + match.id + "/evidence"} fullWidth variant="secondary">
              {copy.reviewProductInfo}
            </Button>
          ) : null}
        </section>
      ) : match.status === "COMPLETED" ? (
        <Button to={"/deal/" + match.id + "/complete"} fullWidth variant="secondary">
          {copy.viewCompletedTrade}
        </Button>
      ) : (
        <Button to="/my" fullWidth variant="secondary">
          {copy.receivedOffers}
        </Button>
      )}
    </div>
  );
}
