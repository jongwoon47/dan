import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, Field, TextInput } from "@/components/ui/Input";
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
import {
  clearCreateDraft,
  loadCreateDraft,
  saveCreateDraft,
  type CreateDraft,
} from "@/lib/createDraft";
import { fromDatetimeLocalValue, isBorrowRangeValid, isDatetimeLocalNotPast } from "@/lib/datetime";
import {
  budgetLabelForType,
  digitsOnly,
  formatDigitsGrouped,
  formatPriceThought,
  parseMoneyInput,
} from "@/lib/format";
import { findProductByMatchKey, productMatchKey } from "@/domain/productName";
import "./pages.css";
import "@/components/feedCards.css";

const TYPES: DemandType[] = ["BUY", "BORROW", "TASK", "SERVICE"];
const CONDITIONS: ConditionPreference[] = ["sealed", "like_new", "lightly_used", "any"];

type TaskMode = "onsite" | "pickup" | "route" | "remote";
type ServiceMode = "onsite" | "remote";

function parseType(raw: string | null): DemandType | null {
  if (raw === "BUY" || raw === "BORROW" || raw === "TASK" || raw === "SERVICE") {
    return raw;
  }
  return null;
}

function MoneyInput({
  value,
  onChange,
  label,
  hint,
  placeholder,
}: {
  value: string;
  onChange: (digits: string) => void;
  label: string;
  hint?: string;
  placeholder?: string;
}) {
  const thought = formatPriceThought(parseMoneyInput(value));
  return (
    <Field label={label} hint={hint}>
      <TextInput
        inputMode="numeric"
        value={formatDigitsGrouped(value)}
        onChange={(e) => onChange(digitsOnly(e.target.value))}
        placeholder={placeholder}
      />
      {thought ? <p className="price-thought">{thought}</p> : null}
    </Field>
  );
}

export function CreateDemandPage() {
  const { products, createDemand, ensureProduct, currentUser, isLoggedIn } = useDan();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draft = loadCreateDraft();
  const paramType = parseType(params.get("type"));

  const [type, setType] = useState<DemandType | null>(
    paramType ?? draft?.type ?? null,
  );
  const [title, setTitle] = useState(draft?.title ?? "");
  const [productId, setProductId] = useState(draft?.productId ?? "");
  const [productQuery, setProductQuery] = useState(draft?.productQuery ?? "");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(
    draft?.maxPrice && draft.maxPrice !== "1000000" ? draft.maxPrice : "",
  );
  const [budget, setBudget] = useState(
    draft?.budget && draft.budget !== "20000" ? draft.budget : "",
  );
  const [condition, setCondition] = useState<ConditionPreference>(
    draft?.condition ?? "any",
  );
  const [itemName, setItemName] = useState(draft?.itemName ?? "");
  const [detail, setDetail] = useState(draft?.detail ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const profileArea = currentUser?.defaultArea?.trim() ?? "";
  const [buyShipping, setBuyShipping] = useState(draft?.buyShipping ?? true);
  const [buyMeetup, setBuyMeetup] = useState(
    () => draft?.buyMeetup ?? Boolean(profileArea),
  );
  const [meetupPlace, setMeetupPlace] = useState(
    draft?.meetupPlace ?? profileArea,
  );
  const [borrowPlace, setBorrowPlace] = useState(
    draft?.borrowPlace ?? profileArea,
  );
  const [borrowStart, setBorrowStart] = useState(draft?.borrowStart ?? "");
  const [borrowEnd, setBorrowEnd] = useState(draft?.borrowEnd ?? "");
  const [taskMode, setTaskMode] = useState<TaskMode>(draft?.taskMode ?? "pickup");
  const [taskPlace, setTaskPlace] = useState(draft?.taskPlace ?? profileArea);
  const [routeFrom, setRouteFrom] = useState(draft?.routeFrom ?? "");
  const [routeTo, setRouteTo] = useState(draft?.routeTo ?? "");
  const [dueAt, setDueAt] = useState(draft?.dueAt ?? "");
  const [serviceMode, setServiceMode] = useState<ServiceMode>(
    draft?.serviceMode ?? "onsite",
  );
  const [servicePlace, setServicePlace] = useState(
    draft?.servicePlace ?? profileArea,
  );
  const [preferredAt, setPreferredAt] = useState(draft?.preferredAt ?? "");
  const [phase, setPhase] = useState<1 | 2>(1);

  useEffect(() => {
    if (paramType) setType(paramType);
  }, [paramType]);

  useEffect(() => {
    setPhase(1);
  }, [type]);

  useEffect(() => {
    const next: CreateDraft = {
      type,
      title,
      productQuery,
      productId,
      maxPrice,
      budget,
      condition,
      itemName,
      detail,
      buyShipping,
      buyMeetup,
      meetupPlace,
      borrowPlace,
      borrowStart,
      borrowEnd,
      taskMode,
      taskPlace,
      routeFrom,
      routeTo,
      dueAt,
      serviceMode,
      servicePlace,
      preferredAt,
    };
    saveCreateDraft(next);
  }, [
    type,
    title,
    productQuery,
    productId,
    maxPrice,
    budget,
    condition,
    itemName,
    detail,
    buyShipping,
    buyMeetup,
    meetupPlace,
    borrowPlace,
    borrowStart,
    borrowEnd,
    taskMode,
    taskPlace,
    routeFrom,
    routeTo,
    dueAt,
    serviceMode,
    servicePlace,
    preferredAt,
  ]);

  const selected = products.find((p) => p.id === productId);
  const price = type === "BUY" ? parseMoneyInput(maxPrice) : parseMoneyInput(budget);

  const suggestions = useMemo(() => {
    const q = productQuery.trim();
    if (q.length < 1) return [];
    const qKey = productMatchKey(q);
    const qLower = q.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(qLower) ||
          (qKey.length > 0 && productMatchKey(p.name).includes(qKey)),
      )
      .slice(0, 5);
  }, [products, productQuery]);

  const exactMatch = useMemo(
    () => findProductByMatchKey(products, productQuery),
    [products, productQuery],
  );

  const fulfillmentOptions = useMemo((): FulfillmentOption[] => {
    if (!type) return [];
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

  const scheduleError = useMemo(() => {
    if (type === "BORROW") {
      if (!borrowStart.trim() || !borrowEnd.trim()) return ko.timeRequiredError;
      if (!isBorrowRangeValid(borrowStart, borrowEnd)) return ko.borrowRangeError;
      if (
        !isDatetimeLocalNotPast(borrowStart) ||
        !isDatetimeLocalNotPast(borrowEnd)
      ) {
        return ko.timePastError;
      }
      return null;
    }
    if (type === "TASK") {
      if (!dueAt.trim()) return ko.timeRequiredError;
      if (!isDatetimeLocalNotPast(dueAt)) return ko.timePastError;
      return null;
    }
    if (type === "SERVICE") {
      if (!preferredAt.trim()) return ko.timeRequiredError;
      if (!isDatetimeLocalNotPast(preferredAt)) return ko.timePastError;
      return null;
    }
    return null;
  }, [type, borrowStart, borrowEnd, dueAt, preferredAt]);

  const canCore = useMemo(() => {
    if (!type || !Number.isFinite(price) || price <= 0) return false;
    if (type === "BUY") return Boolean(productQuery.trim());
    if (type === "BORROW") return Boolean(title.trim() || itemName.trim());
    return Boolean(title.trim() || detail.trim());
  }, [type, price, productQuery, title, itemName, detail]);

  const canSubmit = useMemo(() => {
    if (!canCore) return false;
    if (!areFulfillmentOptionsValid(fulfillmentOptions)) return false;
    if (scheduleError) return false;
    if (type === "BUY") return buyShipping || buyMeetup;
    return true;
  }, [
    canCore,
    fulfillmentOptions,
    scheduleError,
    type,
    buyShipping,
    buyMeetup,
  ]);

  async function submit() {
    if (!canSubmit || submitting || !type) return;
    if (scheduleError) {
      setFormError(scheduleError);
      return;
    }
    if (!isLoggedIn) {
      navigate("/login?next=/create");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      if (type === "BUY") {
        const rawName = productQuery.trim();
        const picked =
          selected &&
          productMatchKey(selected.name) === productMatchKey(rawName)
            ? selected
            : exactMatch;
        let pid = picked?.id;
        let productName = picked?.name;
        if (!pid) {
          const createdProduct = await ensureProduct(rawName);
          if (!createdProduct) {
            setFormError(ko.genericError);
            return;
          }
          pid = createdProduct.id;
          productName = createdProduct.name;
        }
        const created = await createDemand({
          type: "BUY",
          title: title.trim() || productName || rawName,
          productId: pid,
          maxPrice: price,
          conditionPreference: condition,
          fulfillmentOptions,
        });
        if (created && created.type === "BUY") {
          clearCreateDraft();
          navigate(`/demand/item/${created.id}`);
        } else {
          setFormError(ko.genericError);
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
          startAt: fromDatetimeLocalValue(borrowStart),
          endAt: fromDatetimeLocalValue(borrowEnd),
        });
        if (created) {
          clearCreateDraft();
          navigate(`/demand/item/${created.id}`);
        } else {
          setFormError(ko.genericError);
        }
        return;
      }
      if (type === "TASK") {
        const created = await createDemand({
          type: "TASK",
          title: title.trim() || detail.trim(),
          taskDescription: detail.trim() || title.trim(),
          budget: price,
          fulfillmentOptions,
          dueAt: fromDatetimeLocalValue(dueAt),
        });
        if (created) {
          clearCreateDraft();
          navigate(`/demand/item/${created.id}`);
        } else {
          setFormError(ko.genericError);
        }
        return;
      }
      const created = await createDemand({
        type: "SERVICE",
        title: title.trim() || detail.trim(),
        serviceDescription: detail.trim() || title.trim(),
        budget: price,
        fulfillmentOptions,
        preferredAt: fromDatetimeLocalValue(preferredAt),
      });
      if (created) {
        clearCreateDraft();
        navigate(`/demand/item/${created.id}`);
      } else {
        setFormError(ko.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack page-narrow create-page">
      <section className="create-page__body section-stack">
        <h2 className="section-title">
          {phase === 1 ? ko.whatNeeded : "어디서 · 언제 필요하세요?"}
        </h2>

        <div className="type-segment" role="radiogroup" aria-label="요청 유형">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              className={type === t ? "type-segment__btn is-selected" : "type-segment__btn"}
              onClick={() => {
                setType(t);
                setPhase(1);
              }}
            >
              {DEMAND_TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        {!type ? (
          <p className="section-desc">{ko.pickDemandType}</p>
        ) : (
          <>
            <div className="create-steps" aria-label="작성 단계">
              <span className={phase === 1 ? "is-active" : ""}>1. {ko.stepWhat}</span>
              <span className={phase === 2 ? "is-active" : ""}>2. {ko.stepWhereWhen}</span>
            </div>

            {phase === 1 ? (
              <>
                {type !== "BUY" ? (
                  <Field label={ko.titleLabel}>
                    <TextInput
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={ko.composerPlaceholder}
                    />
                  </Field>
                ) : null}

                {type === "BUY" ? (
                  <>
                    <div className="product-suggest">
                      <Field label={ko.productSearch} hint={ko.productSearchHint}>
                        <TextInput
                          value={productQuery}
                          onChange={(e) => {
                            setProductQuery(e.target.value);
                            setProductId("");
                            setSuggestOpen(true);
                          }}
                          onFocus={() => setSuggestOpen(true)}
                          onBlur={() => {
                            window.setTimeout(() => setSuggestOpen(false), 120);
                          }}
                          placeholder={ko.productSearchPh}
                          autoComplete="off"
                        />
                      </Field>
                      {suggestOpen && suggestions.length > 0 ? (
                        <ul className="product-suggest__list" role="listbox">
                          {suggestions.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                role="option"
                                className={
                                  productId === p.id
                                    ? "product-suggest__item is-selected"
                                    : "product-suggest__item"
                                }
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setProductId(p.id);
                                  setProductQuery(p.name);
                                  setSuggestOpen(false);
                                }}
                              >
                                {p.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <MoneyInput
                      label={ko.maxPrice}
                      hint={ko.maxPriceHint}
                      value={maxPrice}
                      onChange={setMaxPrice}
                      placeholder="예: 800,000"
                    />
                    <div>
                      <p className="field-inline-label">{ko.condition}</p>
                      <ChipGroup>
                        {CONDITIONS.map((c) => (
                          <Chip
                            key={c}
                            selected={condition === c}
                            onClick={() => setCondition(c)}
                          >
                            {CONDITION_LABEL[c]}
                          </Chip>
                        ))}
                      </ChipGroup>
                    </div>
                  </>
                ) : null}

                {type === "BORROW" ? (
                  <>
                    <Field label={ko.itemName}>
                      <TextInput
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="예: 캠핑 텐트"
                      />
                    </Field>
                    <MoneyInput
                      label={budgetLabelForType(type)}
                      hint={ko.borrowBudgetHint}
                      value={budget}
                      onChange={setBudget}
                      placeholder="예: 30,000"
                    />
                  </>
                ) : null}

                {type === "TASK" || type === "SERVICE" ? (
                  <>
                    <Field label={ko.descLabel}>
                      <TextInput
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder="예: 평택역에서 짐 옮겨주세요"
                      />
                    </Field>
                    <MoneyInput
                      label={budgetLabelForType(type)}
                      value={budget}
                      onChange={setBudget}
                      placeholder="예: 20,000"
                    />
                  </>
                ) : null}
              </>
            ) : null}

            {phase === 2 ? (
              <>
                {type === "BUY" ? (
                  <>
                    <div>
                      <p className="field-inline-label">{ko.tradeMethod}</p>
                      <ChipGroup>
                        <Chip
                          selected={buyShipping}
                          onClick={() => setBuyShipping((v) => !v)}
                        >
                          {ko.buyShippingOpt}
                        </Chip>
                        <Chip
                          selected={buyMeetup}
                          onClick={() => setBuyMeetup((v) => !v)}
                        >
                          {ko.buyMeetupOpt}
                        </Chip>
                      </ChipGroup>
                    </div>
                    {buyMeetup ? (
                      <Field label={ko.buyMeetupWhere}>
                        <TextInput
                          value={meetupPlace}
                          onChange={(e) => setMeetupPlace(e.target.value)}
                          placeholder={ko.locationPh}
                        />
                      </Field>
                    ) : null}
                  </>
                ) : null}

                {type === "BORROW" ? (
                  <>
                    <Field label={ko.borrowWhere}>
                      <TextInput
                        value={borrowPlace}
                        onChange={(e) => setBorrowPlace(e.target.value)}
                        placeholder={ko.locationPh}
                      />
                    </Field>
                    <Field label={ko.borrowStart}>
                      <TextInput
                        type="datetime-local"
                        value={borrowStart}
                        onChange={(e) => setBorrowStart(e.target.value)}
                      />
                    </Field>
                    <Field label={ko.borrowEnd}>
                      <TextInput
                        type="datetime-local"
                        value={borrowEnd}
                        onChange={(e) => setBorrowEnd(e.target.value)}
                      />
                    </Field>
                    <Field label={ko.descLabel}>
                      <TextInput
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                      />
                    </Field>
                  </>
                ) : null}

                {type === "TASK" ? (
                  <div className="section-stack">
                    <div>
                      <p className="field-inline-label">{ko.fulfillHow}</p>
                      <ChipGroup>
                        <Chip
                          selected={taskMode === "onsite"}
                          onClick={() => setTaskMode("onsite")}
                        >
                          {ko.taskModeOnsite}
                        </Chip>
                        <Chip
                          selected={taskMode === "pickup"}
                          onClick={() => setTaskMode("pickup")}
                        >
                          {ko.taskModePickup}
                        </Chip>
                        <Chip
                          selected={taskMode === "route"}
                          onClick={() => setTaskMode("route")}
                        >
                          {ko.taskModeRoute}
                        </Chip>
                        <Chip
                          selected={taskMode === "remote"}
                          onClick={() => setTaskMode("remote")}
                        >
                          {ko.taskModeRemote}
                        </Chip>
                      </ChipGroup>
                    </div>
                    {taskMode === "route" ? (
                      <div className="route-fields">
                        <Field label={ko.taskRouteFrom}>
                          <TextInput
                            value={routeFrom}
                            onChange={(e) => setRouteFrom(e.target.value)}
                            placeholder={ko.placePh}
                          />
                        </Field>
                        <span className="route-arrow" aria-hidden>
                          {ko.routeArrow}
                        </span>
                        <Field label={ko.taskRouteTo}>
                          <TextInput
                            value={routeTo}
                            onChange={(e) => setRouteTo(e.target.value)}
                            placeholder={ko.placePh}
                          />
                        </Field>
                      </div>
                    ) : null}
                    {taskMode === "onsite" || taskMode === "pickup" ? (
                      <Field
                        label={
                          taskMode === "pickup" ? ko.taskPickupPlace : ko.taskPlace
                        }
                      >
                        <TextInput
                          value={taskPlace}
                          onChange={(e) => setTaskPlace(e.target.value)}
                          placeholder={ko.locationPh}
                        />
                      </Field>
                    ) : null}
                    <Field label={ko.dueAt}>
                      <TextInput
                        type="datetime-local"
                        value={dueAt}
                        onChange={(e) => setDueAt(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}

                {type === "SERVICE" ? (
                  <div className="section-stack">
                    <div>
                      <p className="field-inline-label">{ko.fulfillHow}</p>
                      <ChipGroup>
                        <Chip
                          selected={serviceMode === "onsite"}
                          onClick={() => setServiceMode("onsite")}
                        >
                          {ko.serviceOnsite}
                        </Chip>
                        <Chip
                          selected={serviceMode === "remote"}
                          onClick={() => setServiceMode("remote")}
                        >
                          {ko.serviceRemote}
                        </Chip>
                      </ChipGroup>
                    </div>
                    {serviceMode === "onsite" ? (
                      <Field label={ko.servicePlace}>
                        <TextInput
                          value={servicePlace}
                          onChange={(e) => setServicePlace(e.target.value)}
                          placeholder={ko.locationPh}
                        />
                      </Field>
                    ) : null}
                    <Field label={ko.preferredAt}>
                      <TextInput
                        type="datetime-local"
                        value={preferredAt}
                        onChange={(e) => setPreferredAt(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : null}

                {formError || scheduleError ? (
                  <p className="form-error">{formError ?? scheduleError}</p>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>

      {type ? (
        <div className="create-page__footer">
          {phase === 1 ? (
            <Button fullWidth size="lg" disabled={!canCore} onClick={() => setPhase(2)}>
              {ko.stepNext}
            </Button>
          ) : (
            <div className="action-row create-page__actions">
              <Button variant="secondary" fullWidth onClick={() => setPhase(1)}>
                {ko.stepPrev}
              </Button>
              <Button
                fullWidth
                size="lg"
                onClick={() => void submit()}
                disabled={!canSubmit || submitting}
              >
                {submitting
                  ? ko.saving
                  : isLoggedIn
                    ? ko.submitDemand
                    : ko.submitNeedLogin}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
