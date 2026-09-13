import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipGroup } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ItemCondition } from "@/domain/types";
import { CONDITION_LABEL } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

const CONDITIONS: ItemCondition[] = ["sealed", "like_new", "lightly_used"];

export function OwnershipPage() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const { getProduct, getAggregate, createOwnership } = useDan();
  const product = getProduct(productId);
  const aggregate = getAggregate(productId);
  const [condition, setCondition] = useState<ItemCondition>("lightly_used");
  const [doneId, setDoneId] = useState<string | null>(null);

  if (!product) {
    return (
      <EmptyState
        title={ko.missingProduct}
        action={<Button to="/feed" variant="secondary">{ko.goBack}</Button>}
      />
    );
  }

  function register() {
    // Mutations resolve the demo actor synchronously (no login?create race).
    const ownership = createOwnership({ productId, condition });
    if (ownership) setDoneId(ownership.id);
  }

  if (doneId) {
    return (
      <div className="page-stack">
        <Card className="section-stack success-card aha-card">
          <p className="hero__eyebrow">Aha</p>
          <h1 className="page-title">{product.name}</h1>
          <p className="detail-hero__count">
            <strong>
              {aggregate?.seekerCount ?? 0}
              {ko.myung}
            </strong>
            {ko.seekingDetailSuffix.replace(ko.myung, "")}
          </p>
          <div className="kpi-strip">
            <div className="kpi-strip__item">
              <span>{ko.ownAhaHigh}</span>
              <strong>{formatWon(aggregate?.highestIntentPrice ?? 0)}</strong>
            </div>
            <div className="kpi-strip__item">
              <span>{ko.thisWeek}</span>
              <strong className="demand-card__trend">
                +{aggregate?.recent7dDelta ?? 0}
                {ko.myung}
              </strong>
            </div>
          </div>
          <p className="section-desc">{ko.ownDoneBody}</p>
          <Button fullWidth size="lg" onClick={() => navigate(`/ownership/${doneId}/sell-intent`)}>
            {ko.sellCta}
          </Button>
          <Button to={`/demand/${productId}`} variant="secondary" fullWidth>
            {ko.reviewDemand}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">{ko.ownTitle}</h1>
        <p className="section-desc">{ko.ownDesc}</p>
      </header>
      <Card className="section-stack">
        <div className="own-product">
          <ProductVisual product={product} size="sm" />
          <div>
            <h2 className="section-title">{product.name}</h2>
            <p className="section-desc">
              {ko.seekersLabel} {aggregate?.seekerCount ?? 0}
              {ko.myung}
            </p>
          </div>
        </div>
        <div>
          <p className="field-inline-label">{ko.condition}</p>
          <ChipGroup>
            {CONDITIONS.map((c) => (
              <Chip key={c} selected={condition === c} onClick={() => setCondition(c)}>
                {CONDITION_LABEL[c]}
              </Chip>
            ))}
          </ChipGroup>
        </div>
        <Button fullWidth size="lg" onClick={register}>
          {ko.registerOwned}
        </Button>
      </Card>
    </div>
  );
}
