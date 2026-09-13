import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { CategoryPill, ProductVisual } from "@/components/ProductVisual";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { CONDITION_LABEL, MATCH_STATUS_LABEL, type Match } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./matchCard.css";

export function MatchCard({ match }: { match: Match }) {
  const { currentUser, getProduct, state, expressBuyerInterest, connectAsSeller } = useDan();
  const product = getProduct(match.productId);
  const demand = state.demands.find((d) => d.id === match.demandId);
  const sell = state.sellIntents.find((s) => s.id === match.sellIntentId);
  const ownership = state.ownerships.find((o) => o.id === sell?.ownershipId);

  if (!product || !demand || !sell || !ownership || !currentUser) return null;

  const isBuyer = match.buyerId === currentUser.id;
  const isSeller = match.sellerId === currentUser.id;

  return (
    <Card className="match-card">
      <div className="match-card__head">
        <ProductVisual product={product} size="sm" />
        <div>
          <div className="match-card__badges">
            <CategoryPill category={product.category} />
            <Badge tone="accent">{MATCH_STATUS_LABEL[match.status]}</Badge>
          </div>
          <h3>{product.name}</h3>
          <p className="match-card__lead">{ko.matchLead}</p>
        </div>
      </div>

      <div className="match-card__compare">
        <div>
          <span>{ko.buyUntil}</span>
          <strong>
            {formatWon(demand.maxPrice)} {ko.untilSuffix}
          </strong>
        </div>
        <div className="match-card__compare-divider" aria-hidden>
          =
        </div>
        <div>
          <span>{ko.sellFrom}</span>
          <strong>
            {formatWon(sell.minimumPrice)} {ko.fromSuffix}
          </strong>
        </div>
      </div>

      <div className="match-card__grid">
        <div>
          <span>{ko.condition}</span>
          <strong>{CONDITION_LABEL[ownership.condition]}</strong>
        </div>
        <div>
          <span>{ko.location}</span>
          <strong>{demand.location}</strong>
        </div>
        <div>
          <span>{isBuyer ? ko.sellConsiderPrice : ko.hopePrice}</span>
          <strong>{formatWon(isBuyer ? sell.minimumPrice : demand.maxPrice)}</strong>
        </div>
      </div>

      <div className="match-card__actions">
        {isBuyer && match.status === "POTENTIAL" ? (
          <Button fullWidth onClick={() => expressBuyerInterest(match.id)}>
            {ko.sendInterest}
          </Button>
        ) : null}
        {isBuyer && match.status === "BUYER_INTERESTED" ? (
          <Button fullWidth variant="secondary" disabled>
            {ko.waitingSeller}
          </Button>
        ) : null}
        {isSeller && match.status === "BUYER_INTERESTED" ? (
          <Button fullWidth onClick={() => connectAsSeller(match.id)}>
            {ko.connect}
          </Button>
        ) : null}
        {match.status === "CONNECTED" ? (
          <div className="match-card__connected">
            <p>{ko.connectedMsg}</p>
            <Button to="/my" variant="secondary" fullWidth>
              {ko.viewInMy}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function MatchList({ matches }: { matches: Match[] }) {
  if (matches.length === 0) {
    return (
      <EmptyState
        title={ko.noMatch}
        body={ko.noMatchBody}
        action={
          <Button to="/feed" variant="secondary">
            {ko.navFeed}
          </Button>
        }
      />
    );
  }
  return (
    <div className="section-stack">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}
