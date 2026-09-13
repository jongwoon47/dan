import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, Field, TextInput, TextSelect } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type {
  ConditionPreference,
  DemandType,
  TradeMethod,
} from "@/domain/types";
import { CONDITION_LABEL, DEMAND_TYPE_LABEL, TRADE_LABEL } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

const TYPES: DemandType[] = ["BUY", "BORROW", "TASK", "SERVICE"];
const CONDITIONS: ConditionPreference[] = ["sealed", "like_new", "lightly_used", "any"];
const TRADES: TradeMethod[] = ["meetup", "shipping", "any"];

function parseType(raw: string | null): DemandType {
  if (raw === "BUY" || raw === "BORROW" || raw === "TASK" || raw === "SERVICE") {
    return raw;
  }
  return "BUY";
}

export function CreateDemandPage() {
  const { products, createDemand } = useDan();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [type, setType] = useState<DemandType>(parseType(params.get("type")));
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [maxPrice, setMaxPrice] = useState("1000000");
  const [budget, setBudget] = useState("20000");
  const [location, setLocation] = useState<string>(String(ko.seoul));
  const [condition, setCondition] = useState<ConditionPreference>("any");
  const [tradeMethod, setTradeMethod] = useState<TradeMethod>("any");
  const [itemName, setItemName] = useState("");
  const [detail, setDetail] = useState("");

  const selected = products.find((p) => p.id === productId);
  const price = Number((type === "BUY" ? maxPrice : budget).replace(/,/g, ""));
  const canSubmit = useMemo(() => {
    if (!Number.isFinite(price) || price <= 0) return false;
    if (type === "BUY") return Boolean(selected);
    if (type === "BORROW") return Boolean(title.trim() || itemName.trim());
    return Boolean(title.trim() || detail.trim());
  }, [price, selected, type, title, itemName, detail]);

  function submit() {
    if (!canSubmit) return;
    if (type === "BUY" && selected) {
      const created = createDemand({
        type: "BUY",
        title: title.trim() || selected.name,
        productId: selected.id,
        maxPrice: price,
        conditionPreference: condition,
        location: location.trim() || ko.seoul,
        tradeMethod,
      });
      if (created && created.type === "BUY") {
        navigate(`/demand/${created.details.productId}`);
      }
      return;
    }
    if (type === "BORROW") {
      const created = createDemand({
        type: "BORROW",
        title: title.trim() || itemName.trim(),
        itemName: itemName.trim() || title.trim(),
        budget: price,
        location: location.trim() || ko.seoul,
        description: detail,
      });
      if (created) navigate(`/demand/item/${created.id}`);
      return;
    }
    if (type === "TASK") {
      const created = createDemand({
        type: "TASK",
        title: title.trim() || detail.trim(),
        taskDescription: detail.trim() || title.trim(),
        budget: price,
        location: location.trim() || ko.seoul,
      });
      if (created) navigate(`/demand/item/${created.id}`);
      return;
    }
    const created = createDemand({
      type: "SERVICE",
      title: title.trim() || detail.trim(),
      serviceDescription: detail.trim() || title.trim(),
      budget: price,
      location: location.trim() || ko.seoul,
    });
    if (created) navigate(`/demand/item/${created.id}`);
  }

  return (
    <div className="page-stack create-page">
      <header className="page-header">
        <h1 className="page-title">{ko.createTitle}</h1>
        <p className="section-desc">{ko.createDesc}</p>
      </header>

      <section className="section-stack create-panel">
        <h2 className="section-title">{ko.whatNeeded}</h2>
        <ChipGroup>
          {TYPES.map((t) => (
            <Chip key={t} selected={type === t} onClick={() => setType(t)}>
              {DEMAND_TYPE_LABEL[t]}
            </Chip>
          ))}
        </ChipGroup>

        <Field label={ko.titleLabel}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ko.composerPlaceholder} />
        </Field>

        {type === "BUY" ? (
          <>
            <Field label={ko.product}>
              <TextSelect value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </TextSelect>
            </Field>
            <Field label={ko.maxPrice} hint={ko.maxPriceHint}>
              <TextInput inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
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
          </>
        ) : null}

        {type === "BORROW" ? (
          <Field label={ko.itemName}>
            <TextInput value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </Field>
        ) : null}

        {type !== "BUY" ? (
          <Field label={type === "TASK" || type === "SERVICE" ? ko.descLabel : ko.descLabel}>
            <TextInput value={detail} onChange={(e) => setDetail(e.target.value)} />
          </Field>
        ) : null}

        {type !== "BUY" ? (
          <Field label={type === "TASK" || type === "SERVICE" ? ko.reward : ko.budgetLabel}>
            <TextInput inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
        ) : null}

        <Field label={ko.location}>
          <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder={ko.locationPh} />
        </Field>

        <Button fullWidth size="lg" onClick={submit} disabled={!canSubmit}>
          {ko.submitDemand}
        </Button>
      </section>
    </div>
  );
}
