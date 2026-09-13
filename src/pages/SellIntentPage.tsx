import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatWon } from "@/lib/format";
import "./pages.css";

export function SellIntentPage() {
  const { ownershipId = "" } = useParams();
  const navigate = useNavigate();
  const { myOwnerships, getProduct, getAggregate, createSellIntent, myMatches } = useDan();
  const ownership = myOwnerships.find((o) => o.id === ownershipId);
  const product = ownership ? getProduct(ownership.productId) : undefined;
  const aggregate = ownership ? getAggregate(ownership.productId) : null;
  const suggested = aggregate?.highestIntentPrice ?? 0;
  const [price, setPrice] = useState(suggested ? String(suggested) : "1800000");
  const [busy, setBusy] = useState(false);

  if (!ownership || !product) {
    return (
      <EmptyState
        title={ko.missingOwn}
        body={ko.missingOwnBody}
        action={<Button to="/feed" variant="secondary">{ko.navFeed}</Button>}
      />
    );
  }

  async function submit() {
    if (busy) return;
    const minimumPrice = Number(price.replace(/,/g, ""));
    if (!Number.isFinite(minimumPrice) || minimumPrice <= 0) return;
    setBusy(true);
    try {
      const created = await createSellIntent({ ownershipId, minimumPrice });
      if (created) navigate("/my?tab=matches");
    } finally {
      setBusy(false);
    }
  }

  const previewMatches = myMatches.filter((m) => m.productId === ownership.productId).length;
  const typed = Number(price.replace(/,/g, "")) || 0;

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">{ko.sellTitle}</h1>
        <p className="section-desc">
          {ko.sellPrompt}
          <br />
          {ko.sellNotListing}
        </p>
      </header>
      <Card className="section-stack">
        <div className="sell-summary">
          <h2 className="section-title">{product.name}</h2>
          <div className="kpi-strip">
            <div className="kpi-strip__item">
              <span>{ko.currentHighest}</span>
              <strong>{formatWon(aggregate?.highestIntentPrice ?? 0)}</strong>
            </div>
            <div className="kpi-strip__item">
              <span>{ko.seekersLabel}</span>
              <strong>
                {aggregate?.seekerCount ?? 0}
                {ko.myung}
              </strong>
            </div>
          </div>
        </div>

        <div className="sell-sentence">
          <p>{ko.iWould}</p>
          <TextInput
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
            aria-label={ko.minPriceLabel}
          />
          <p>{ko.sellSentenceEnd}</p>
        </div>

        {typed > 0 ? (
          <p className="section-desc">
            {formatWon(typed)} {ko.fromSuffix}  |  {ko.highestHopeShort}{" "}
            {formatWon(aggregate?.highestIntentPrice ?? 0)}
          </p>
        ) : null}

        <Button fullWidth size="lg" onClick={() => void submit()} disabled={busy}>
          {busy ? "..." : ko.sellCta}
        </Button>
        {previewMatches > 0 ? (
          <p className="section-desc">
            {ko.relatedMatchesMid}
            {previewMatches}
            {ko.relatedMatchesEnd}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
