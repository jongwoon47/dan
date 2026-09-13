import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip, ChipGroup, Field, TextInput, TextSelect } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ConditionPreference, ProductCategory, TradeMethod } from "@/domain/types";
import { CATEGORY_LABEL, CONDITION_LABEL, TRADE_LABEL } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

const CONDITIONS: ConditionPreference[] = ["sealed", "like_new", "lightly_used", "any"];
const TRADES: TradeMethod[] = ["meetup", "shipping", "any"];

export function CreateDemandPage() {
  const { products, createDemand } = useDan();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [condition, setCondition] = useState<ConditionPreference>("any");
  const [maxPrice, setMaxPrice] = useState("1750000");
  const [location, setLocation] = useState<string>(ko.seoul);
  const [tradeMethod, setTradeMethod] = useState<TradeMethod>("any");

  const filteredProducts = useMemo(() => {
    if (category === "all") return products;
    return products.filter((p) => p.category === category);
  }, [products, category]);

  const selected = products.find((p) => p.id === productId);
  const price = Number(maxPrice.replace(/,/g, ""));
  const canSubmit = Boolean(selected && Number.isFinite(price) && price > 0);

  function submit() {
    if (!selected || !canSubmit) return;
    // Mutations resolve the demo actor synchronously (no login?create race).
    const created = createDemand({
      productId: selected.id,
      maxPrice: price,
      conditionPreference: condition,
      location: location.trim() || ko.seoul,
      tradeMethod,
    });
    if (!created) return;
    navigate(`/demand/${selected.id}`);
  }

  return (
    <div className="page-stack create-page">
      <header className="page-header">
        <h1 className="page-title">{ko.createTitle}</h1>
        <p className="section-desc">{ko.createDesc}</p>
        <div className="stepper" aria-label="steps">
          {[1, 2].map((n) => (
            <span
              key={n}
              className={["stepper__dot", step === n ? "is-active" : "", step > n ? "is-done" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              {n}
            </span>
          ))}
        </div>
      </header>

      <Card className="create-card">
        {step === 1 ? (
          <div className="section-stack">
            <h2 className="section-title">{ko.stepEssentials}</h2>
            <ChipGroup>
              <Chip selected={category === "all"} onClick={() => setCategory("all")}>
                {ko.all}
              </Chip>
              {(Object.keys(CATEGORY_LABEL) as ProductCategory[]).map((key) => (
                <Chip key={key} selected={category === key} onClick={() => setCategory(key)}>
                  {CATEGORY_LABEL[key]}
                </Chip>
              ))}
            </ChipGroup>
            <Field label={ko.product}>
              <TextSelect value={productId} onChange={(e) => setProductId(e.target.value)}>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label={ko.maxPrice} hint={ko.maxPriceHint}>
              <TextInput
                inputMode="numeric"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
            {selected && canSubmit ? (
              <p className="confirm-box__quote">
                &ldquo;{selected.name} ? {formatWon(price)} {ko.quotePrefix}&rdquo;
              </p>
            ) : null}
            <Button fullWidth onClick={() => setStep(2)} disabled={!canSubmit}>
              {ko.next}
            </Button>
            <Button fullWidth variant="secondary" onClick={submit} disabled={!canSubmit}>
              {ko.submitDemand}
            </Button>
          </div>
        ) : null}

        {step === 2 && selected ? (
          <div className="section-stack">
            <h2 className="section-title">{ko.stepOptional}</h2>
            <p className="section-desc">{ko.optionalDetails}</p>
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
            <Field label={ko.location}>
              <TextInput
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={ko.locationPh}
              />
            </Field>
            <div>
              <p className="field-inline-label">{ko.tradeMethod}</p>
              <ChipGroup>
                {TRADES.map((t) => (
                  <Chip key={t} selected={tradeMethod === t} onClick={() => setTradeMethod(t)}>
                    {TRADE_LABEL[t]}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
            <div className="confirm-box">
              <p className="confirm-box__product">{selected.name}</p>
              <p className="confirm-box__quote">
                &ldquo;{formatWon(price)} {ko.quotePrefix}&rdquo;
              </p>
            </div>
            <div className="btn-row">
              <Button variant="secondary" onClick={() => setStep(1)}>
                {ko.prev}
              </Button>
              <Button onClick={submit}>{ko.submitDemand}</Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
