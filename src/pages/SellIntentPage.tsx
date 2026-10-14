import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { fillCopyTemplate } from "@/copy/dealChain";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import { useDanLocale } from "@/i18n/locale";
import {
  digitsOnly,
  formatDigitsGrouped,
  formatStoredMoney,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

export function SellIntentPage() {
  const locale = useDanLocale();
  const copy = useDanCopy();
  const { ownershipId = "" } = useParams();
  const navigate = useNavigate();
  const { myOwnerships, getProduct, getAggregate, createSellIntent } = useDan();
  const ownership = myOwnerships.find((o) => o.id === ownershipId);
  const product = ownership ? getProduct(ownership.productId) : undefined;
  const aggregate = ownership ? getAggregate(ownership.productId) : null;
  const suggested = aggregate?.highestIntentPrice ?? 0;
  const money = (value: number) => formatStoredMoney(value, "KRW", locale);

  const [price, setPrice] = useState(suggested ? String(suggested) : "");
  const [usageCount, setUsageCount] = useState("");
  const [conditionNote, setConditionNote] = useState("");
  const [quickPhotoUrl, setQuickPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);

  useDeepHeader({ title: copy.detailSendOfferCta });

  if (!ownership || !product) {
    return (
      <EmptyState
        title={copy.missingOwn}
        body={copy.missingOwnBody}
        action={<Button to="/feed" variant="secondary">{copy.viewBuyDemand}</Button>}
      />
    );
  }

  async function pickPhoto(file?: File) {
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError(copy.dealImageFileOnly);
      return;
    }
    if (file.size > 700_000) {
      setPhotoError(copy.dealPhotoTooLarge);
      return;
    }
    try {
      setQuickPhotoUrl(await fileToDataUrl(file));
    } catch {
      setPhotoError(copy.dealPhotoReadFailed);
    }
  }

  async function submit() {
    if (busy) return;
    const minimumPrice = parseMoneyInput(price);
    if (!Number.isFinite(minimumPrice) || minimumPrice <= 0) return;
    setBusy(true);
    try {
      const created = await createSellIntent({
        ownershipId,
        minimumPrice,
        approxUsageCount: usageCount ? Number(usageCount) : undefined,
        conditionNote: conditionNote.trim() || undefined,
        quickPhotoUrl: quickPhotoUrl || undefined,
      });
      if (created) navigate("/my");
    } finally {
      setBusy(false);
    }
  }

  const typed = parseMoneyInput(price);
  const seekerCount = aggregate?.seekerCount ?? 0;

  return (
    <div className="page-stack page-narrow quick-offer-page">
      <section className="deal-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">{copy.quickOfferEyebrow}</p>
          <h1 className="page-title">{product.name}</h1>
          {seekerCount > 0 ? (
            <p className="quick-offer-signal">
              {fillCopyTemplate(copy.quickOfferSeeking, { n: seekerCount })}
            </p>
          ) : null}
        </div>
      </section>

      {suggested > 0 ? (
        <section className="live-demand-banner">
          <span>{copy.currentBuyHighest}</span>
          <strong>{money(suggested)}</strong>
          <button type="button" onClick={() => setPrice(String(suggested))}>
            {copy.useThisPrice}
          </button>
        </section>
      ) : null}

      <section className="section-stack quick-offer-form">
        <Field label={copy.quickOfferPriceLabel} hint={copy.sellIntentPriceHint}>
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(price, locale)}
            onChange={(e) => setPrice(digitsOnly(e.target.value))}
            placeholder={copy.quickOfferPricePh}
          />
        </Field>

        {product.category === "camera" ? (
          <Field label={copy.approxShutter} hint={copy.sellIntentShutterHint}>
            <TextInput
              inputMode="numeric"
              value={formatDigitsGrouped(usageCount, locale)}
              onChange={(e) => setUsageCount(digitsOnly(e.target.value))}
              placeholder={copy.approxShutterPh}
            />
          </Field>
        ) : null}

        <Field label={copy.conditionNoteShort}>
          <TextInput
            value={conditionNote}
            onChange={(e) => setConditionNote(e.target.value)}
            placeholder={copy.conditionNotePh}
          />
        </Field>

        <div>
          <p className="field-inline-label">
            {copy.photoOneOptional}{" "}
            <span className="muted">{copy.offerPriceOptional}</span>
          </p>
          <label className="evidence-upload evidence-upload--quick">
            {quickPhotoUrl ? (
              <img src={quickPhotoUrl} alt={copy.evidencePhotoAlt} />
            ) : (
              <span>{copy.photoHelpBuyer}</span>
            )}
            <input type="file" accept="image/*" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
          </label>
          {photoError ? <p className="form-error">{photoError}</p> : null}
        </div>

        <div className="quick-offer-note">
          <strong>{copy.offerLightTitle}</strong>
          <p>{copy.detailOfferNowBody}</p>
        </div>

        <Button fullWidth size="lg" onClick={() => void submit()} disabled={busy || typed <= 0}>
          {busy ? copy.offerSending : copy.detailSendOfferCta}
        </Button>
      </section>
    </div>
  );
}
