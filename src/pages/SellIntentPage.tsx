import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import {
  digitsOnly,
  formatDigitsGrouped,
  formatWon,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

export function SellIntentPage() {
  const { ownershipId = "" } = useParams();
  const navigate = useNavigate();
  const {
    myOwnerships,
    getProduct,
    getAggregate,
    createSellIntent,
    myMatches,
  } = useDan();
  const ownership = myOwnerships.find((o) => o.id === ownershipId);
  const product = ownership ? getProduct(ownership.productId) : undefined;
  const aggregate = ownership ? getAggregate(ownership.productId) : null;
  const productIdForNav = ownership?.productId;
  const suggested =
    aggregate && aggregate.highestIntentPrice > 0
      ? aggregate.highestIntentPrice
      : 0;
  const [price, setPrice] = useState(suggested ? String(suggested) : "");
  const [busy, setBusy] = useState(false);

  if (!ownership || !product || !productIdForNav) {
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
    const minimumPrice = parseMoneyInput(price);
    if (!Number.isFinite(minimumPrice) || minimumPrice <= 0) return;
    setBusy(true);
    try {
      const created = await createSellIntent({ ownershipId, minimumPrice });
      if (created) {
        const related = myMatches.find(
          (m) =>
            m.productId === productIdForNav &&
            (m.status === "CONNECTED" || m.status === "BUYER_INTERESTED"),
        );
        if (related?.status === "CONNECTED") {
          navigate(`/match/${related.id}`);
        } else {
          navigate("/chats");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const typed = parseMoneyInput(price);
  const seekerCount = aggregate?.seekerCount ?? 0;

  return (
    <div className="page-stack page-narrow">
      <section className="section-stack sell-summary">
        <h2 className="section-title">{product.name}</h2>
        <p className="section-desc">{ko.sellNotListing}</p>
        {suggested > 0 || seekerCount > 0 ? (
          <div className="kpi-strip kpi-strip--compact">
            {suggested > 0 ? (
              <div className="kpi-strip__item">
                <span>{ko.currentHighest}</span>
                <strong>{formatWon(suggested)}</strong>
              </div>
            ) : null}
            {seekerCount > 0 ? (
              <div className="kpi-strip__item">
                <span>{ko.seekersLabel}</span>
                <strong>
                  {seekerCount}
                  {ko.myung}
                </strong>
              </div>
            ) : null}
          </div>
        ) : null}

        {suggested > 0 ? (
          <button
            type="button"
            className="text-link"
            onClick={() => setPrice(String(suggested))}
          >
            {ko.suggestPrice}: {formatWon(suggested)}
          </button>
        ) : null}

        <div className="sell-sentence">
          <p>{ko.iWould}</p>
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(price)}
            onChange={(e) => setPrice(digitsOnly(e.target.value))}
            aria-label={ko.minPriceLabel}
            placeholder={suggested > 0 ? formatDigitsGrouped(String(suggested)) : "예: 1,500,000"}
          />
          <p>{ko.sellSentenceEnd}</p>
        </div>

        {typed > 0 && suggested > 0 ? (
          <p className="section-desc">
            {formatWon(typed)} {ko.fromSuffix}
            {" · "}
            {ko.highestHopeShort} {formatWon(suggested)}
          </p>
        ) : null}

        <Button
          fullWidth
          size="lg"
          onClick={() => void submit()}
          disabled={busy || typed <= 0}
        >
          {busy ? ko.saving : ko.sellCta}
        </Button>
      </section>
    </div>
  );
}
