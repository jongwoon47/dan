import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductVisual } from "@/components/ProductVisual";
import { useDan } from "@/domain/danContext";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { CONDITION_LABEL, type Match } from "@/domain/types";
import { isBuyDemand } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./matchCard.css";

function formatOfferTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function matchStatusLabel(match: Match): string {
  if (match.status === "COMPLETED") return "거래 완료";
  if (match.status === "CONNECTED") {
    if (match.dealStage === "PAYMENT_PENDING") return "결제 필요";
    if (match.dealStage === "PAID" || match.dealStage === "HANDOFF_READY") return "인계 확인";
    if (match.dealStage === "DEAL_LOCKED") return "거래 조건 확정";
    if (match.dealStage === "EVIDENCE_READY" || match.dealStage === "DEAL_REVIEW") return "거래 조건 확인";
    return "채팅 중";
  }
  if (match.status === "BUYER_INTERESTED") return "상대 수락 대기";
  if (match.status === "SELLER_ACCEPTED") return "연결 준비";
  return "새 제안";
}

function matchHref(match: Match): string {
  if (match.status === "COMPLETED") return `/deal/${match.id}/complete`;
  if (match.status === "CONNECTED") return `/match/${match.id}`;
  return `/offer/${match.id}`;
}

export function MatchCard({ match }: { match: Match }) {
  const locale = useDanLocale();
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
  const status = matchStatusLabel(match);
  const currency = demand.currencyCode ?? "KRW";
  const money = (value: number) => formatStoredMoney(value, currency, locale);

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
            {busy ? "연결 중…" : "연결하기"}
          </Button>
        ) : null}
      </article>
    );
  }

  const buyMax = isBuyDemand(demand) ? demand.details.maxPrice : demand.budget;
  const offerTime = formatOfferTime(sell.createdAt);
  const delta = buyMax - sell.minimumPrice;

  if (isBuyer) {
    return (
      <article className="trade-row-card trade-row-card--offer">
        <Link to={matchHref(match)} className="trade-row-card__link">
          {sell.quickPhotoUrl ? (
            <img
              className="trade-row-card__photo"
              src={sell.quickPhotoUrl}
              alt={`${product.name} 판매자가 올린 현재 물품`}
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
              {delta >= 0
                ? `내 최대가보다 ${money(delta)} 낮아요`
                : `내 최대가보다 ${money(Math.abs(delta))} 높아요`}
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
          <small>구매자 최대 {money(buyMax)} · {formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
        </div>
        <span className="trade-row-card__chevron" aria-hidden>›</span>
      </Link>

      {isSeller && match.status === "BUYER_INTERESTED" ? (
        <div className="trade-row-card__inline-action">
          <Button size="sm" onClick={() => void onConnect()} disabled={busy}>
            {busy ? "연결 중…" : "구매자와 연결하기"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export function MatchList({ matches, emptyWhenZero = true }: { matches: Match[]; emptyWhenZero?: boolean; }) {
  if (matches.length === 0) {
    if (!emptyWhenZero) return null;
    return (
      <EmptyState
        title="아직 거래가 없어요"
        body="요청을 올리거나 탐색에서 다른 사람의 요청에 제안해보세요."
        action={<Button to="/feed" variant="secondary">탐색하기</Button>}
      />
    );
  }
  return <div className="trade-row-list">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>;
}
