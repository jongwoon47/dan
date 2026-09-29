import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { CategoryPill, ProductVisual } from "@/components/ProductVisual";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { CONDITION_LABEL, MATCH_STATUS_LABEL, type Match } from "@/domain/types";
import { isBuyDemand } from "@/domain/types";
import { formatWon } from "@/lib/format";
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

export function MatchCard({ match }: { match: Match }) {
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

  if (!sell || !ownership) {
    const isBuyer = match.buyerId === currentUser.id;
    return (
      <Card className="match-card">
        <div className="match-card__head">
          <div>
            <Badge tone="accent">{MATCH_STATUS_LABEL[match.status]}</Badge>
            <h3>{demand.title}</h3>
            <p className="match-card__lead">{ko.matchLead}</p>
          </div>
        </div>
        {match.status === "CONNECTED" || match.status === "COMPLETED" ? (
          <div className="match-card__connected">
            <p>{match.status === "COMPLETED" ? ko.tradeDoneTitle : ko.connectedMsg}</p>
            <Button to={`/match/${match.id}`} fullWidth variant={match.status === "COMPLETED" ? "secondary" : "primary"}>
              {ko.openChat}
            </Button>
          </div>
        ) : null}
        {!isBuyer && match.status === "BUYER_INTERESTED" ? (
          <Button fullWidth onClick={() => void onConnect()} disabled={busy}>
            {busy ? "..." : ko.connect}
          </Button>
        ) : null}
      </Card>
    );
  }

  if (!product) return null;

  const buyMax = isBuyDemand(demand) ? demand.details.maxPrice : demand.budget;
  const isBuyer = match.buyerId === currentUser.id;
  const isSeller = match.sellerId === currentUser.id;
  const offerTime = formatOfferTime(sell.createdAt);

  if (isBuyer) {
    return (
      <article className="received-offer-card">
        <div className="received-offer-card__main">
          <ProductVisual product={product} size="sm" />
          <div className="received-offer-card__body">
            <div className="received-offer-card__head">
              <div>
                <h3>{product.name}</h3>
                <p className="received-offer-card__price">{formatWon(sell.minimumPrice)}</p>
              </div>
              {offerTime ? <span>{offerTime}</span> : null}
            </div>

            <p className="received-offer-card__summary">
              {sell.approxUsageCount != null
                ? `약 ${sell.approxUsageCount.toLocaleString("ko-KR")}컷`
                : CONDITION_LABEL[ownership.condition]}
              {sell.conditionNote ? ` · ${sell.conditionNote}` : ""}
            </p>

            <div className="received-offer-card__tags">
              <span>필수 조건 충족</span>
              <span>희망가 이내</span>
              <span>{formatFulfillmentSummary(demand.fulfillmentOptions)}</span>
            </div>

            <Link to={`/profile/${match.sellerId}`} className="received-offer-card__trust">
              판매자 Trust History 보기
            </Link>
          </div>
        </div>

        <div className="received-offer-card__actions">
          <Button
            to={"/offer/" + match.id}
            fullWidth
            variant={match.status === "POTENTIAL" ? "primary" : "secondary"}
          >
            {match.status === "POTENTIAL"
              ? "제안 상세 보기"
              : match.status === "BUYER_INTERESTED"
                ? "제안 상태 확인"
                : match.status === "CONNECTED"
                  ? "거래 진행 보기"
                  : "거래 기록 보기"}
          </Button>
        </div>
      </article>
    );
  }

  return (
    <Card className="match-card">
      <div className="match-card__head">
        <ProductVisual product={product} size="sm" />
        <div>
          <div className="match-card__badges">
            {product.category !== "other" ? <CategoryPill category={product.category} /> : null}
            <Badge tone="accent">{MATCH_STATUS_LABEL[match.status]}</Badge>
          </div>
          <h3>{product.name}</h3>
          <p className="match-card__lead">구매자가 이 제안을 검토하고 있어요.</p>
        </div>
      </div>

      <div className="match-card__compare">
        <div><span>{ko.buyUntil}</span><strong>{formatWon(buyMax)} {ko.untilSuffix}</strong></div>
        <div className="match-card__compare-divider" aria-hidden>↔</div>
        <div><span>{ko.sellFrom}</span><strong>{formatWon(sell.minimumPrice)} {ko.fromSuffix}</strong></div>
      </div>

      <div className="match-card__actions">
        {isSeller && match.status === "BUYER_INTERESTED" ? (
          <Button fullWidth to={`/deal/${match.id}/evidence`}>
            구매자가 관심을 보였어요 · 증거 제출
          </Button>
        ) : null}
        {match.status === "CONNECTED" || match.status === "COMPLETED" ? (
          <div className="match-card__connected">
            <p>{match.status === "COMPLETED" ? ko.tradeDoneTitle : "상세 증거가 준비됐어요. 거래 조건을 확인하세요."}</p>
            {match.status === "CONNECTED" ? (
              <Button to={`/deal/${match.id}/snapshot`} fullWidth>거래 조건 확인</Button>
            ) : null}
            <Button to={`/match/${match.id}`} fullWidth variant="secondary">{ko.openChat}</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function MatchList({ matches, emptyWhenZero = true }: { matches: Match[]; emptyWhenZero?: boolean; }) {
  if (matches.length === 0) {
    if (!emptyWhenZero) return null;
    return (
      <EmptyState title={ko.noMatch} body={ko.noMatchBody} action={<Button to="/feed" variant="secondary">{ko.navFeed}</Button>} />
    );
  }
  return <div className="section-stack">{matches.map((match) => <MatchCard key={match.id} match={match} />)}</div>;
}
