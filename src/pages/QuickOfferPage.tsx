import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, Field, TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { ItemCondition, Ownership, TradeMethod } from "@/domain/types";
import { fillCopyTemplate } from "@/copy/dealChain";
import { useDanCopy } from "@/copy/useDanCopy";
import { conditionLabel, tradeLabel } from "@/i18n/categories";
import { useDanLocale } from "@/i18n/locale";
import {
  digitsOnly,
  formatDigitsGrouped,
  formatStoredMoney,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

const CONDITIONS: ItemCondition[] = ["sealed", "like_new", "lightly_used"];
const SELLER_TRADE_METHODS: TradeMethod[] = ["meetup", "shipping", "any"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

export function QuickOfferPage() {
  const locale = useDanLocale();
  const copy = useDanCopy();
  const { productId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetDemandId = searchParams.get("target")?.trim() || undefined;
  const {
    getProduct,
    getDemand,
    getAggregate,
    myOwnerships,
    createOwnership,
    createSellIntent,
    isLoggedIn,
  } = useDan();
  const money = (value: number, currency: "KRW" | "JPY" = "KRW") =>
    formatStoredMoney(value, currency, locale);

  const product = getProduct(productId);
  const aggregate = getAggregate(productId);
  const targetDemand = targetDemandId ? getDemand(targetDemandId) : undefined;
  const targetBuyDemand =
    targetDemand?.type === "BUY" && targetDemand.details.productId === productId
      ? targetDemand
      : undefined;
  const existingOwnership = myOwnerships.find(
    (row) => row.productId === productId && row.status === "OWNED",
  );

  const [condition, setCondition] = useState<ItemCondition | null>(
    existingOwnership?.condition ?? null,
  );
  const [price, setPrice] = useState(
    targetBuyDemand?.details.maxPrice
      ? String(targetBuyDemand.details.maxPrice)
      : aggregate?.highestIntentPrice
        ? String(aggregate.highestIntentPrice)
        : "",
  );
  const [usageCount, setUsageCount] = useState("");
  const [conditionNote, setConditionNote] = useState("");
  const [tradeMethod, setTradeMethod] = useState<TradeMethod>("any");
  const [quickPhotoUrl, setQuickPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useDeepHeader({ title: copy.quickOfferTitle });

  if (!product) {
    return (
      <EmptyState
        title={copy.missingProduct}
        action={<Button to="/" variant="secondary">{copy.navHome}</Button>}
      />
    );
  }

  const typedPrice = parseMoneyInput(price);
  const showUsageCount = product.category === "camera";
  const canSubmit = Boolean(condition && typedPrice > 0);

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
    if (!canSubmit || !condition || busy) return;
    if (!isLoggedIn) {
      navigate(`/login?next=/demand/${productId}/offer`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      let ownership: Ownership | undefined = existingOwnership;
      if (!ownership) {
        ownership =
          (await createOwnership({ productId, condition })) ?? undefined;
      }
      if (!ownership) {
        setError(copy.ownershipCreateFail);
        return;
      }

      const offer = await createSellIntent({
        ownershipId: ownership.id,
        minimumPrice: typedPrice,
        approxUsageCount:
          showUsageCount && usageCount ? Number(usageCount) : undefined,
        conditionNote: conditionNote.trim() || undefined,
        targetDemandId: targetBuyDemand?.id,
        tradeMethod,
        quickPhotoUrl: quickPhotoUrl || undefined,
      });
      if (!offer) {
        setError(copy.offerSendFail);
        return;
      }
      navigate("/my");
    } catch {
      setError(copy.offerSendFail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack page-narrow quick-offer-page quick-offer-page--blueprint">
      <section className="deal-product-card quick-offer-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">{copy.quickOfferEyebrow}</p>
          <h1 className="page-title">{product.name}</h1>
          {aggregate?.seekerCount ? (
            <p className="quick-offer-signal">
              {fillCopyTemplate(copy.quickOfferSeeking, {
                n: aggregate.seekerCount,
              })}
            </p>
          ) : null}
        </div>
      </section>

      {targetBuyDemand ? (
        <section className="live-demand-banner">
          <span>{copy.selectedBuyMax}</span>
          <strong>
            {money(targetBuyDemand.details.maxPrice, targetBuyDemand.currencyCode ?? "KRW")}
          </strong>
          <button type="button" onClick={() => setPrice(String(targetBuyDemand.details.maxPrice))}>
            {copy.useThisPrice}
          </button>
        </section>
      ) : aggregate?.highestIntentPrice ? (
        <section className="live-demand-banner">
          <span>{copy.currentBuyHighest}</span>
          <strong>{money(aggregate.highestIntentPrice)}</strong>
          <button
            type="button"
            onClick={() => setPrice(String(aggregate.highestIntentPrice))}
          >
            {copy.useThisPrice}
          </button>
        </section>
      ) : null}

      <section className="section-stack quick-offer-form">
        <Field label={copy.quickOfferPriceLabel} hint={copy.quickOfferPriceHint}>
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(price, locale)}
            onChange={(event) => setPrice(digitsOnly(event.target.value))}
            placeholder={copy.quickOfferPricePh}
          />
        </Field>

        <div>
          <p className="field-inline-label">{copy.myItemCondition}</p>
          <ChipGroup>
            {CONDITIONS.map((item) => (
              <Chip
                key={item}
                selected={condition === item}
                onClick={() => setCondition(item)}
              >
                {conditionLabel(locale, item)}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        <div>
          <p className="field-inline-label">{copy.possibleTradeMethod}</p>
          <ChipGroup>
            {SELLER_TRADE_METHODS.map((item) => (
              <Chip
                key={item}
                selected={tradeMethod === item}
                onClick={() => setTradeMethod(item)}
              >
                {item === "any" ? copy.tradeBoth : tradeLabel(locale, item)}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        <details className="offer-extra-details" open={Boolean(quickPhotoUrl || conditionNote || usageCount)}>
          <summary>
            <span>
              <strong>{copy.extraInfo}</strong>
              <small>{copy.offerPriceOptional}</small>
            </span>
            <span aria-hidden>⌄</span>
          </summary>
          <div className="offer-extra-details__body">
            {showUsageCount ? (
              <Field
                label={copy.approxShutter}
                hint={copy.approxShutterHint}
              >
                <TextInput
                  inputMode="numeric"
                  value={formatDigitsGrouped(usageCount, locale)}
                  onChange={(event) =>
                    setUsageCount(digitsOnly(event.target.value))
                  }
                  placeholder={copy.approxShutterPh}
                />
              </Field>
            ) : null}

            <Field label={copy.conditionNoteLabel}>
              <TextInput
                value={conditionNote}
                onChange={(event) => setConditionNote(event.target.value)}
                placeholder={copy.conditionNotePh}
              />
            </Field>

            <div className="quick-offer-photo">
              <div className="quick-offer-photo__head">
                <strong>{copy.photoLabel}</strong>
                <small>{copy.photoOptionalHint}</small>
              </div>
              <label className="evidence-upload evidence-upload--quick">
                {quickPhotoUrl ? (
                  <img src={quickPhotoUrl} alt={copy.evidencePhotoAlt} />
                ) : (
                  <span>{copy.photoHelp}</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void pickPhoto(event.target.files?.[0])}
                />
              </label>
              {photoError ? (
                <p className="form-error" role="alert">
                  {photoError}
                </p>
              ) : null}
            </div>
          </div>
        </details>

        <p className="quick-offer-helper">
          {copy.quickOfferHelper}
        </p>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          fullWidth
          size="lg"
          disabled={!canSubmit || busy}
          onClick={() => void submit()}
        >
          {busy ? copy.offerSending : copy.detailSendOfferCta}
        </Button>
      </section>
    </div>
  );
}
