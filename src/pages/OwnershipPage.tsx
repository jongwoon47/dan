import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ItemCondition } from "@/domain/types";
import { CONDITION_LABEL } from "@/domain/types";
import { clearOwnDraft, loadOwnDraft, saveOwnDraft } from "@/lib/actionDraft";
import { formatWon } from "@/lib/format";
import "./pages.css";

const CONDITIONS: ItemCondition[] = ["sealed", "like_new", "lightly_used"];

export function OwnershipPage() {
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const { getProduct, getAggregate, createOwnership } = useDan();
  const product = getProduct(productId);
  const aggregate = getAggregate(productId);
  const [condition, setCondition] = useState<ItemCondition | null>(() =>
    loadOwnDraft(productId),
  );
  const [doneId, setDoneId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!product) {
    return (
      <EmptyState
        title={ko.missingProduct}
        action={<Button to="/feed" variant="secondary">{ko.goBack}</Button>}
      />
    );
  }

  function pickCondition(next: ItemCondition) {
    setCondition(next);
    saveOwnDraft({ productId, condition: next });
  }

  async function register() {
    if (busy || !condition) return;
    saveOwnDraft({ productId, condition });
    setBusy(true);
    try {
      const ownership = await createOwnership({ productId, condition });
      if (ownership) {
        clearOwnDraft();
        setDoneId(ownership.id);
      }
    } finally {
      setBusy(false);
    }
  }

  if (doneId) {
    const seekers = aggregate?.seekerCount ?? 0;
    const highest = aggregate?.highestIntentPrice ?? 0;
    const delta = aggregate?.recent7dDelta ?? 0;
    return (
      <div className="page-stack page-narrow">
        <section className="section-stack">
          <h1 className="page-title">{ko.ownDoneTitle}</h1>
          <p className="section-title">{product.name}</p>
          {seekers > 0 ? (
            <p className="detail-hero__count">
              <strong>
                {seekers}
                {ko.myung}
              </strong>
              {ko.seekingDetailSuffix.replace(ko.myung, "")}
            </p>
          ) : (
            <p className="section-desc">{ko.ownDoneBody}</p>
          )}
          {(highest > 0 || delta > 0) && (
            <div className="kpi-strip kpi-strip--compact">
              {highest > 0 ? (
                <div className="kpi-strip__item">
                  <span>{ko.highestHopeShort}</span>
                  <strong>{formatWon(highest)}</strong>
                </div>
              ) : null}
              {delta > 0 ? (
                <div className="kpi-strip__item">
                  <span>{ko.thisWeek}</span>
                  <strong className="demand-card__trend">
                    +{delta}
                    {ko.myung}
                  </strong>
                </div>
              ) : null}
            </div>
          )}
          {seekers > 0 ? <p className="section-desc">{ko.ownDoneBody}</p> : null}
          <Button
            fullWidth
            size="lg"
            onClick={() => navigate(`/ownership/${doneId}/sell-intent`)}
          >
            {ko.sellCta}
          </Button>
          <Button to={`/demand/${productId}`} variant="secondary" fullWidth>
            {ko.reviewDemand}
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack page-narrow">
      <section className="section-stack">
        <div className="own-product">
          <ProductVisual product={product} size="sm" />
          <div>
            <h2 className="section-title">{product.name}</h2>
            {aggregate && aggregate.seekerCount > 0 ? (
              <p className="section-desc">
                {ko.seekersLabel} {aggregate.seekerCount}
                {ko.myung}
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <p className="field-inline-label">{ko.condition}</p>
          <ChipGroup>
            {CONDITIONS.map((c) => (
              <Chip
                key={c}
                selected={condition === c}
                onClick={() => pickCondition(c)}
              >
                {CONDITION_LABEL[c]}
              </Chip>
            ))}
          </ChipGroup>
        </div>
        <Button
          fullWidth
          size="lg"
          onClick={() => void register()}
          disabled={busy || !condition}
        >
          {busy ? ko.saving : ko.registerOwned}
        </Button>
      </section>
    </div>
  );
}
