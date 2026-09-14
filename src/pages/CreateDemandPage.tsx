import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, Field, TextInput, TextSelect } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import {
  areFulfillmentOptionsValid,
  placeFromLabel,
  type FulfillmentOption,
} from "@/domain/fulfillment";
import type {
  ConditionPreference,
  DemandType,
} from "@/domain/types";
import { CONDITION_LABEL, DEMAND_TYPE_LABEL } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

const TYPES: DemandType[] = ["BUY", "BORROW", "TASK", "SERVICE"];
const CONDITIONS: ConditionPreference[] = ["sealed", "like_new", "lightly_used", "any"];

type TaskMode = "onsite" | "pickup" | "route" | "remote";
type ServiceMode = "onsite" | "remote";

function parseType(raw: string | null): DemandType {
  if (raw === "BUY" || raw === "BORROW" || raw === "TASK" || raw === "SERVICE") {
    return raw;
  }
  return "BUY";
}

export function CreateDemandPage() {
  const { products, createDemand, currentUser } = useDan();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [type, setType] = useState<DemandType>(parseType(params.get("type")));
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [maxPrice, setMaxPrice] = useState("1000000");
  const [budget, setBudget] = useState("20000");
  const [condition, setCondition] = useState<ConditionPreference>("any");
  const [itemName, setItemName] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [buyShipping, setBuyShipping] = useState(true);
  const [buyMeetup, setBuyMeetup] = useState(true);
  const [meetupPlace, setMeetupPlace] = useState(
    currentUser?.defaultArea ?? String(ko.pyeongtaek),
  );
  const defaultArea = currentUser?.defaultArea?.trim() || String(ko.pyeongtaek);
  const [borrowPlace, setBorrowPlace] = useState(defaultArea);
  const [taskMode, setTaskMode] = useState<TaskMode>("pickup");
  const [taskPlace, setTaskPlace] = useState(defaultArea);
  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("onsite");
  const [servicePlace, setServicePlace] = useState(defaultArea);

  const selected = products.find((p) => p.id === productId);
  const price = Number((type === "BUY" ? maxPrice : budget).replace(/,/g, ""));

  const fulfillmentOptions = useMemo((): FulfillmentOption[] => {
    if (type === "BUY") {
      const opts: FulfillmentOption[] = [];
      if (buyShipping) opts.push({ mode: "SHIPPING" });
      if (buyMeetup) {
        opts.push({ mode: "MEETUP", place: placeFromLabel(meetupPlace) });
      }
      return opts;
    }
    if (type === "BORROW") {
      return [{ mode: "PICKUP", place: placeFromLabel(borrowPlace) }];
    }
    if (type === "TASK") {
      if (taskMode === "remote") return [{ mode: "REMOTE" }];
      if (taskMode === "route") {
        return [
          {
            mode: "ROUTE",
            from: placeFromLabel(routeFrom),
            to: placeFromLabel(routeTo),
          },
        ];
      }
      if (taskMode === "onsite") {
        return [{ mode: "ONSITE", place: placeFromLabel(taskPlace) }];
      }
      return [{ mode: "PICKUP", place: placeFromLabel(taskPlace) }];
    }
    if (serviceMode === "remote") return [{ mode: "REMOTE" }];
    return [{ mode: "ONSITE", place: placeFromLabel(servicePlace) }];
  }, [
    type,
    buyShipping,
    buyMeetup,
    meetupPlace,
    borrowPlace,
    taskMode,
    taskPlace,
    routeFrom,
    routeTo,
    serviceMode,
    servicePlace,
  ]);

  const canSubmit = useMemo(() => {
    if (!Number.isFinite(price) || price <= 0) return false;
    if (!areFulfillmentOptionsValid(fulfillmentOptions)) return false;
    if (type === "BUY") return Boolean(selected) && (buyShipping || buyMeetup);
    if (type === "BORROW") return Boolean(title.trim() || itemName.trim());
    return Boolean(title.trim() || detail.trim());
  }, [price, selected, type, title, itemName, detail, fulfillmentOptions, buyShipping, buyMeetup]);

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (type === "BUY" && selected) {
        const created = await createDemand({
          type: "BUY",
          title: title.trim() || selected.name,
          productId: selected.id,
          maxPrice: price,
          conditionPreference: condition,
          fulfillmentOptions,
        });
        if (created && created.type === "BUY") {
          navigate(`/demand/${created.details.productId}`);
        }
        return;
      }
      if (type === "BORROW") {
        const created = await createDemand({
          type: "BORROW",
          title: title.trim() || itemName.trim(),
          itemName: itemName.trim() || title.trim(),
          budget: price,
          fulfillmentOptions,
          description: detail,
        });
        if (created) navigate(`/demand/item/${created.id}`);
        return;
      }
      if (type === "TASK") {
        const created = await createDemand({
          type: "TASK",
          title: title.trim() || detail.trim(),
          taskDescription: detail.trim() || title.trim(),
          budget: price,
          fulfillmentOptions,
        });
        if (created) navigate(`/demand/item/${created.id}`);
        return;
      }
      const created = await createDemand({
        type: "SERVICE",
        title: title.trim() || detail.trim(),
        serviceDescription: detail.trim() || title.trim(),
        budget: price,
        fulfillmentOptions,
      });
      if (created) navigate(`/demand/item/${created.id}`);
    } finally {
      setSubmitting(false);
    }
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
          <TextInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ko.composerPlaceholder}
          />
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
              <TextInput
                inputMode="numeric"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/[^\d]/g, ""))}
              />
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
                <Chip selected={buyShipping} onClick={() => setBuyShipping((v) => !v)}>
                  {ko.buyShippingOpt}
                </Chip>
                <Chip selected={buyMeetup} onClick={() => setBuyMeetup((v) => !v)}>
                  {ko.buyMeetupOpt}
                </Chip>
              </ChipGroup>
            </div>
            {buyMeetup ? (
              <Field label={ko.buyMeetupWhere}>
                <TextInput
                  value={meetupPlace}
                  onChange={(e) => setMeetupPlace(e.target.value)}
                  placeholder={ko.placePh}
                />
              </Field>
            ) : null}
          </>
        ) : null}

        {type === "BORROW" ? (
          <>
            <Field label={ko.itemName}>
              <TextInput value={itemName} onChange={(e) => setItemName(e.target.value)} />
            </Field>
            <Field label={ko.borrowWhere}>
              <TextInput
                value={borrowPlace}
                onChange={(e) => setBorrowPlace(e.target.value)}
                placeholder={ko.placePh}
              />
            </Field>
          </>
        ) : null}

        {type === "TASK" ? (
          <div>
            <p className="field-inline-label">{ko.fulfillHow}</p>
            <ChipGroup>
              <Chip selected={taskMode === "onsite"} onClick={() => setTaskMode("onsite")}>
                {ko.taskModeOnsite}
              </Chip>
              <Chip selected={taskMode === "pickup"} onClick={() => setTaskMode("pickup")}>
                {ko.taskModePickup}
              </Chip>
              <Chip selected={taskMode === "route"} onClick={() => setTaskMode("route")}>
                {ko.taskModeRoute}
              </Chip>
              <Chip selected={taskMode === "remote"} onClick={() => setTaskMode("remote")}>
                {ko.taskModeRemote}
              </Chip>
            </ChipGroup>
            {taskMode === "route" ? (
              <div className="route-fields">
                <Field label={ko.taskRouteFrom}>
                  <TextInput value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)} />
                </Field>
                <span className="route-arrow" aria-hidden>
                  {ko.routeArrow}
                </span>
                <Field label={ko.taskRouteTo}>
                  <TextInput value={routeTo} onChange={(e) => setRouteTo(e.target.value)} />
                </Field>
              </div>
            ) : null}
            {taskMode === "onsite" || taskMode === "pickup" ? (
              <Field label={taskMode === "pickup" ? ko.taskPickupPlace : ko.taskPlace}>
                <TextInput
                  value={taskPlace}
                  onChange={(e) => setTaskPlace(e.target.value)}
                  placeholder={ko.placePh}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {type === "SERVICE" ? (
          <div>
            <p className="field-inline-label">{ko.fulfillHow}</p>
            <ChipGroup>
              <Chip selected={serviceMode === "onsite"} onClick={() => setServiceMode("onsite")}>
                {ko.serviceOnsite}
              </Chip>
              <Chip selected={serviceMode === "remote"} onClick={() => setServiceMode("remote")}>
                {ko.serviceRemote}
              </Chip>
            </ChipGroup>
            {serviceMode === "onsite" ? (
              <Field label={ko.servicePlace}>
                <TextInput
                  value={servicePlace}
                  onChange={(e) => setServicePlace(e.target.value)}
                  placeholder={ko.placePh}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {type !== "BUY" ? (
          <Field label={ko.descLabel}>
            <TextInput value={detail} onChange={(e) => setDetail(e.target.value)} />
          </Field>
        ) : null}

        {type !== "BUY" ? (
          <Field label={type === "TASK" || type === "SERVICE" ? ko.reward : ko.budgetLabel}>
            <TextInput
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))}
            />
          </Field>
        ) : null}

        <Button
          fullWidth
          size="lg"
          onClick={() => void submit()}
          disabled={!canSubmit || submitting}
        >
          {submitting ? "..." : ko.submitDemand}
        </Button>
      </section>
    </div>
  );
}
