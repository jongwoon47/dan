import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import { isBuyDemand, type DealSnapshot, type PublicProfile } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

export function TradeCompletePage() {
  const { matchId = "" } = useParams();
  const locale = useDanLocale();
  const copy = useDanCopy();
  const {
    myMatches,
    state,
    currentUser,
    getProduct,
    getDemand,
    getDealSnapshot,
    getPublicProfile,
    refreshData,
  } = useDan();
  const match = myMatches.find((row) => row.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const sell = match?.sellIntentId
    ? state.sellIntents.find((row) => row.id === match.sellIntentId)
    : undefined;
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [peer, setPeer] = useState<PublicProfile | null>(null);

  useDeepHeader({ title: copy.matchStatusCompleted });

  useEffect(() => {
    if (!matchId || !match || !currentUser) return;
    const peerId =
      currentUser.id === match.buyerId ? match.sellerId : match.buyerId;
    let cancelled = false;

    const load = async () => {
      await refreshData().catch(() => undefined);
      if (cancelled) return;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const [dealSnapshot, publicProfile] = await Promise.all([
          getDealSnapshot(matchId),
          getPublicProfile(peerId),
        ]);
        if (cancelled) return;
        if (publicProfile) setPeer(publicProfile);
        if (dealSnapshot) {
          setSnapshot(dealSnapshot);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    getDealSnapshot,
    getPublicProfile,
    match,
    matchId,
    refreshData,
  ]);

  if (!match || !product || !currentUser) {
    return (
      <EmptyState
        title={copy.dealMissingTitle}
        action={<Button to="/my">{copy.dealMyTrades}</Button>}
      />
    );
  }

  if (match.status !== "COMPLETED") {
    return (
      <EmptyState
        title={copy.tradeNotCompleteTitle}
        body={copy.tradeNotCompleteBody}
        action={<Button to={"/deal/" + match.id + "/handoff"}>{copy.tradeInProgress}</Button>}
      />
    );
  }

  const peerId = currentUser.id === match.buyerId ? match.sellerId : match.buyerId;
  const currency = snapshot?.currencyCode ?? demand?.currencyCode ?? "KRW";
  const finalPrice =
    snapshot?.agreedPrice ??
    sell?.minimumPrice ??
    (demand && isBuyDemand(demand) ? demand.details.maxPrice : demand?.budget);
  const moneyLabel =
    typeof finalPrice === "number"
      ? formatStoredMoney(finalPrice, currency, locale)
      : null;

  return (
    <div className="page-stack page-narrow trade-complete-page">
      <section className="trade-complete-hero">
        <span className="trade-complete-check" aria-hidden>✓</span>
        <h1>{copy.tradeDoneTitle}</h1>
        <p>{copy.tradeCompleteLead}</p>
      </section>

      <section className="trade-complete-product">
        <ProductVisual product={product} size="sm" />
        <div>
          <strong>{product.name}</strong>
          <span>{moneyLabel ?? copy.matchStatusCompleted}</span>
        </div>
      </section>

      <section className="deal-snapshot-card trade-receipt">
        <div className="snapshot-section">
          <span>{copy.tradeStatusLabel}</span>
          <strong>{copy.matchStatusCompleted}</strong>
        </div>
        <div className="snapshot-section">
          <span>{copy.tradeFinalAmountLabel}</span>
          <strong>{moneyLabel ?? copy.amountConfirming}</strong>
        </div>
        <div className="snapshot-section">
          <span>{copy.dealPeer}</span>
          <strong>{peer?.displayName || copy.chatPeerFallback}</strong>
        </div>
        <div className="snapshot-section">
          <span>{copy.tradeCompletedAtLabel}</span>
          <strong>
            {match.completedAt
              ? new Date(match.completedAt).toLocaleString(
                  locale === "ja" ? "ja-JP" : "ko-KR",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )
              : copy.matchStatusCompleted}
          </strong>
        </div>
      </section>

      <Button to="/my?tab=completed" fullWidth>
        {copy.viewTradeHistory}
      </Button>
      <Button to={"/profile/" + peerId} fullWidth variant="secondary">
        {copy.viewPeerProfile}
      </Button>
      <Button to="/" fullWidth variant="ghost">
        {copy.goHome}
      </Button>
    </div>
  );
}
