import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductVisual } from "@/components/ProductVisual";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { CONDITION_LABEL, type Match } from "@/domain/types";
import { isBuyDemand } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatRelativeTime, formatStoredMoney } from "@/lib/format";
import "./matchCard.css";

function matchStatusLabel(match: Match, copy: ReturnType<typeof useDanCopy>, locale: "ko" | "ja"): string {
  if (match.status === "COMPLETED") return copy.matchStatusCompleted;
  if (match.status === "CONNECTED") {
    if (match.dealStage === "PAYMENT_PENDING") return locale === "ja" ? "支払いが必要" : "결제 필요";
    if (match.dealStage === "PAID" || match.dealStage === "HANDOFF_READY") {
      return locale === "ja" ? "受け渡し確認" : "인계 확인";
    }
    if (match.dealStage === "DEAL_LOCKED") return locale === "ja" ? "取引条件確定" : "거래 조건 확정";
    if (match.dealStage === "EVIDENCE_READY" || match.dealStage === "DEAL_REVIEW") {
      return locale === "ja" ? "取引条件の確認" : "거래 조건 확인";
    }
    return locale === "ja" ? "チャット中" : "채팅 중";
  }
  if (match.status === "BUYER_INTERESTED") return locale === "ja" ? "相手の承認待ち" : "상대 수락 대기";
  if (match.status === "SELLER_ACCEPTED") return locale === "ja" ? "接続準備" : "연결 준비";
  return locale === "ja" ? "新しい提案" : "새 제안";
}

function matchHref(match: Match): string {
  if (match.status === "COMPLETED") return `/deal/${match.id}/complete`;
  if (match.status === "CONNECTED") return `/match/${match.id}`;
  return `/offer/${match.id}`;
}

export function MatchCard({ match }: { match: Match }) {
  const locale = useDanLocale();
  const copy = useDanCopy();
  const { currentUser, getProduct, state, connectAsSeller } = useDan();
  const [busy, setBusy] = useState(false);

  async function onConnect() {
    if (busy) return;
    setBusy(true);
    try {
      await connectAsSeller(match.id);
    } finally {
      setBusy(false);
    }
  }

  const demand = state.demands.find((d) => d.id === match.demandId);
  const sell = match.sellIntentId
    ? state.sellIntents.find((s) => s.id === match.sellIntentId)
    : undefined;
  const ownership = sell
    ? state.ownerships.find((o) => o.id === sell.ownershipId)
    : undefined;
  const product = match.productId ? getProduct(match.productId) : undefined;

  if (!demand || !currentUser) return null;

  const isBuyer = match.buyerId === currentUser.id;
  const isSeller = match.sellerId === currentUser.id;
  const status = matchStatusLabel(match, copy, locale);
  const currency = demand.currencyCode ?? "KRW";
  const money = (value: number) => formatStoredMoney(value, currency, locale);
  const connecting = busy ? (locale === "ja" ? "接続中…" : "연결 중…") : copy.connect;

  if (!sell || !ownership || !product) {
    return (
      <article className="trade-row-card">
        <Link to={match.status === "CONNECTED" || match.status === "COMPLETED" ? `/match/${match.id}` : `/demand/item/${demand.id}`} className="trade-row-card__link">
          <span className="request-type-avatar" aria-hidden>{demand.title.slice(0, 1)}</span>
          <div className="trade-row-card__body">
            <div className="trade-row-card__head">
              <strong>{demand.title}</strong>
              <span>{status}</span>
            </div>
            <p>{money(demand.budget)}</p>
            <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
          </div>
          <span className="trade-row-card__chevron" aria-hidden>›</span>
        </Link>
        {!isBuyer && match.status === "BUYER_INTERESTED" ? (
          <Button size="sm" onClick={() => void onConnect()} disabled={busy}>
            {connecting}
          </Button>
        ) : null}
      </article>
    );
  }

  const buyMax = isBuyDemand(demand) ? demand.details.maxPrice : demand.budget;
  const offerTime = formatRelativeTime(sell.createdAt, locale);
  const delta = buyMax - sell.minimumPrice;
  const photoAlt =
    locale === "ja"
      ? `${product.name} 出品者が撮影した現物`
      : `${product.name} 판매자가 올린 현재 물품`;
  const deltaLabel =
    delta >= 0
      ? locale === "ja"
        ? `希望上限より ${money(delta)} 安い`
        : `내 최대가보다 ${money(delta)} 낮아요`
      : locale === "ja"
        ? `希望上限より ${money(Math.abs(delta))} 高い`
        : `내 최대가보다 ${money(Math.abs(delta))} 높아요`;
  const buyerMaxLine =
    locale === "ja"
      ? `購入者の上限 ${money(buyMax)} · ${formatFulfillmentSummary(demand.fulfillmentOptions)}`
      : `구매자 최대 ${money(buyMax)} · ${formatFulfillmentSummary(demand.fulfillmentOptions)}`;
  const connectBuyer =
    busy
      ? locale === "ja"
        ? "接続中…"
        : "연결 중…"
      : locale === "ja"
        ? "購入者と接続する"
        : "구매자와 연결하기";

  if (isBuyer) {
    return (
      <article className="trade-row-card trade-row-card--offer">
        <Link to={matchHref(match)} className="trade-row-card__link">
          {sell.quickPhotoUrl ? (
            <img
              className="trade-row-card__photo"
              src={sell.quickPhotoUrl}
              alt={photoAlt}
            />
          ) : (
            <ProductVisual product={product} size="sm" />
          )}
          <div className="trade-row-card__body">
            <div className="trade-row-card__head">
              <strong>{product.name}</strong>
              <span>{status}</span>
            </div>
            <p className="trade-row-card__price">{money(sell.minimumPrice)}</p>
            <small>
              {CONDITION_LABEL[ownership.condition]}
              {sell.conditionNote ? ` · ${sell.conditionNote}` : ""}
            </small>
            <small className={delta >= 0 ? "trade-row-card__delta is-good" : "trade-row-card__delta"}>
              {deltaLabel}
            </small>
          </div>
          <div className="trade-row-card__trail">
            {offerTime ? <time>{offerTime}</time> : null}
            <span aria-hidden>›</span>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="trade-row-card">
      <Link to={match.status === "CONNECTED" || match.status === "COMPLETED" ? matchHref(match) : `/demand/${product.id}`} className="trade-row-card__link">
        <ProductVisual product={product} size="sm" />
        <div className="trade-row-card__body">
          <div className="trade-row-card__head">
            <strong>{product.name}</strong>
            <span>{status}</span>
          </div>
          <p className="trade-row-card__price">{money(sell.minimumPrice)}</p>
          <small>{buyerMaxLine}</small>
        </div>
        <span className="trade-row-card__chevron" aria-hidden>›</span>
      </Link>

      {isSeller && match.status === "BUYER_INTERESTED" ? (
        <div className="trade-row-card__inline-action">
          <Button size="sm" onClick={() => void onConnect()} disabled={busy}>
            {connectBuyer}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function MatchList({ matches, emptyWhenZero = true }: { matches: Match[]; emptyWhenZero?: boolean; }) {
  const copy = useDanCopy();
  if (matches.length === 0) {
    if (!emptyWhenZero) return null;
    return (
      <EmptyState
        title={copy.noMatch}
        body={copy.noMatchBody}
        action={<Button to="/feed" variant="secondary">{copy.ctaBrowse}</Button>}
      />
    );
  }
  return <div className="trade-row-list">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>;
}
