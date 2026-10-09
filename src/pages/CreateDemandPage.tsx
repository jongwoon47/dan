import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, DatetimeLocalInput, Field, TextInput } from "@/components/ui/Input";
import { useDanCopy } from "@/copy/useDanCopy";
import { translate, useDanLocale } from "@/i18n/locale";
import { useDan } from "@/domain/danContext";
import {
  areFulfillmentOptionsValid,
  placeFromLabel,
  type FulfillmentOption,
  type Place,
} from "@/domain/fulfillment";
import type {
  ConditionPreference,
  DemandType,
} from "@/domain/types";
import { CONDITION_LABEL } from "@/domain/types";
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
  formatKRWForLanguage,
  parseMoneyInput,
} from "@/lib/format";
import { requestCurrentPlace } from "@/lib/geolocation";
import {
  findProductByMatchKey,
  filterProductSuggestions,
  productMatchKey,
} from "@/domain/productName";
import "./pages.css";
import "@/components/feedCards.css";

const TYPES: DemandType[] = ["BUY", "BORROW", "TASK", "SERVICE"];
const JP_TYPE_META: Record<DemandType, { label: string; desc: string }> = {
  BUY: { label: "買いたい", desc: "購入したい物があります" },
  BORROW: { label: "借りたい", desc: "少しの間、借りたいです" },
  TASK: { label: "おつかい", desc: "誰かにお願いしたいことがあります" },
  SERVICE: { label: "お手伝い", desc: "誰かの力を借りたいです" },
};

const TYPE_META: Record<DemandType, { label: string; desc: string }> = {
  BUY: { label: "구매", desc: "사고 싶은 물건이 있어요" },
  BORROW: { label: "빌리기", desc: "잠깐 빌리고 싶어요" },
  TASK: { label: "심부름", desc: "대신 해줄 일을 찾고 있어요" },
  SERVICE: { label: "서비스", desc: "전문가의 도움이 필요해요" },
};

function RequestTypeIcon({ type }: { type: DemandType }) {
  if (type === "BUY") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6.5 8.5h11l-1 10h-9l-1-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 9V7.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "BORROW") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 8h12.5M15 5.5 17.5 8 15 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 16H6.5M9 13.5 6.5 16 9 18.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "TASK") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7 5.5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="m8.5 12 2 2 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M14.8 6.2a4.2 4.2 0 0 0-5.4 5.4L5.2 15.8a1.8 1.8 0 1 0 2.6 2.6l4.2-4.2a4.2 4.2 0 0 0 5.4-5.4l-2.5 2.5-2.2-2.2 2.1-2.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const CONDITIONS: ConditionPreference[] = ["sealed", "like_new", "lightly_used", "any"];

type TaskMode = "onsite" | "pickup" | "route" | "remote";
type ServiceMode = "onsite" | "remote";

function composePublicPlaceLabel(area: string, note: string): string {
  const a = area.trim();
  const n = note.trim();
  if (a && n) return `${a} · ${n}`;
  return a || n;
}

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
  kind = "buy",
}: {
  value: string;
  onChange: (digits: string) => void;
  label: string;
  hint?: string;
  placeholder?: string;
  kind?: "buy" | "borrow" | "reward";
}) {
  const locale = useDanLocale();
  const amount = parseMoneyInput(value);
  const thought = locale === "ja"
    ? amount > 0
      ? `金額は韓国ウォン（KRW）: ${formatKRWForLanguage(amount, "ja")}`
      : "現在はKRWのみ対応しています。"
    : formatPriceThought(amount, kind);
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

/** Do not silently save a Japan-market request as a Korean KRW trade.
 * The JP authoring flow opens only after true JPY handling and legal review.
 */
export function CreateDemandPage() {
  const [marketParams] = useSearchParams();
  const locale = useDanLocale();
  if (marketParams.get("country") === "JP") {
    const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
    return (
      <div className="page-stack page-narrow">
        <section className="settings-section" aria-labelledby="japan-market-not-ready">
          <h1 id="japan-market-not-ready">
            {locale === "ja" ? "日本向けの依頼は準備中です" : "일본 거래 작성은 준비 중이에요"}
          </h1>
          <p className="section-desc">
            {locale === "ja"
              ? "現在は韓国ウォン（KRW）の韓国取引のみ投稿できます。日本の依頼を韓国の取引として保存せず、円（JPY）と利用条件の対応後に公開します。"
              : "현재 작성 가능한 거래는 한국·원화(KRW) 기준이에요. 일본 요청을 한국 거래로 잘못 저장하지 않도록 일본 엔화(JPY)와 현지 이용 조건이 준비될 때까지 작성 기능을 제한합니다."}
          </p>
          <p className="section-desc">{t("jpPrefectureHint")}</p>
          <p className="section-desc">{t("consentLegalPendingJa")}</p>
          <p className="section-desc">{t("marketTimezoneHint")}</p>
          <Button to="/feed?country=KR" variant="secondary">
            {locale === "ja" ? "韓国の依頼を探す" : "한국 거래 탐색으로 이동"}
          </Button>
        </section>
      </div>
    );
  }
  return <CreateDemandForm />;
}

function CreateDemandForm() {
  const copy = useDanCopy();
  const locale = useDanLocale();
  const { products, createDemand, ensureProduct, currentUser, isLoggedIn } = useDan();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draft = loadCreateDraft();
  const paramType = parseType(params.get("type"));
  const paramQuery = params.get("q")?.trim() ?? "";

  const [type, setType] = useState<DemandType | null>(
    paramType ?? draft?.type ?? null,
  );
  const [title, setTitle] = useState(draft?.title ?? "");
  const [productId, setProductId] = useState(draft?.productId ?? "");
  const [productQuery, setProductQuery] = useState(paramQuery || draft?.productQuery || "");
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
  const [taskMode, setTaskMode] = useState<TaskMode | null>(
    draft?.taskMode ?? null,
  );
  const [taskPlace, setTaskPlace] = useState(draft?.taskPlace ?? profileArea);
  const [routeFrom, setRouteFrom] = useState(draft?.routeFrom ?? "");
  const [routeTo, setRouteTo] = useState(draft?.routeTo ?? "");
  const [dueAt, setDueAt] = useState(draft?.dueAt ?? "");
  const [serviceMode, setServiceMode] = useState<ServiceMode | null>(
    draft?.serviceMode ?? null,
  );
  const [servicePlace, setServicePlace] = useState(
    draft?.servicePlace ?? profileArea,
  );
  const [servicePlaceNote, setServicePlaceNote] = useState(
    draft?.servicePlaceNote ?? "",
  );
  const [serviceGeoPlace, setServiceGeoPlace] = useState<Place | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState(
    draft?.estimatedDuration ?? "",
  );
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [preferredAt, setPreferredAt] = useState(draft?.preferredAt ?? "");
  const [phase, setPhase] = useState<1 | 2>(1);
  const [scheduleTouched, setScheduleTouched] = useState(false);

  useEffect(() => {
    if (paramType) setType(paramType);
  }, [paramType]);

  function hasWritableContent() {
    return Boolean(
      title.trim() ||
        detail.trim() ||
        itemName.trim() ||
        productQuery.trim() ||
        productId ||
        maxPrice ||
        budget ||
        estimatedDuration.trim() ||
        servicePlaceNote.trim() ||
        serviceGeoPlace ||
        borrowStart ||
        borrowEnd ||
        dueAt ||
        preferredAt ||
        taskMode ||
        serviceMode ||
        routeFrom.trim() ||
        routeTo.trim() ||
        phase === 2,
    );
  }

  function selectType(next: DemandType) {
    if (next === type) return;
    if (hasWritableContent() && !window.confirm(copy.typeSwitchConfirm)) return;
    setType(next);
    setPhase(1);
    setScheduleTouched(false);
    setFormError(null);
    // Type switch starts a new ask — do not carry previous title/product copy.
    setTitle("");
    setDetail("");
    setItemName("");
    setProductQuery("");
    setProductId("");
    setSuggestOpen(false);
    setMaxPrice("");
    setBudget("");
    setEstimatedDuration("");
    setServicePlaceNote("");
    setServiceGeoPlace(null);
    setGeoError(null);
  }

  function phase1Title(demandType: DemandType) {
    switch (demandType) {
      case "BUY":
        return "어떤 물건을 찾고 있나요?";
      case "BORROW":
        return "어떤 물건을 빌리고 싶나요?";
      case "TASK":
        return "어떤 일을 부탁하고 싶나요?";
      case "SERVICE":
        return "어떤 도움이 필요하세요?";
    }
  }

  function phase2Title(demandType: DemandType) {
    switch (demandType) {
      case "BUY":
        return copy.phase2Buy;
      case "BORROW":
        return copy.phase2Borrow;
      case "TASK":
        return copy.phase2Task;
      case "SERVICE":
        return copy.phase2Service;
    }
  }

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
      servicePlaceNote,
      estimatedDuration,
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
    servicePlaceNote,
    estimatedDuration,
    preferredAt,
  ]);

  const selected = products.find((p) => p.id === productId);
  const price = type === "BUY" ? parseMoneyInput(maxPrice) : parseMoneyInput(budget);

  const suggestions = useMemo(
    () => filterProductSuggestions(products, productQuery, 5),
    [products, productQuery],
  );
  const showProductSuggestions =
    suggestOpen && productQuery.trim().length > 0 && suggestions.length > 0;

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
      if (!taskMode) return [];
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
    if (!serviceMode) return [];
    if (serviceMode === "remote") return [{ mode: "REMOTE" }];
    const label = composePublicPlaceLabel(
      serviceGeoPlace?.region2 ?? serviceGeoPlace?.publicLabel ?? servicePlace,
      servicePlaceNote,
    );
    if (serviceGeoPlace) {
      return [
        {
          mode: "ONSITE",
          place: {
            ...serviceGeoPlace,
            publicLabel: label || serviceGeoPlace.publicLabel,
          },
        },
      ];
    }
    return [{ mode: "ONSITE", place: placeFromLabel(label) }];
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
    servicePlaceNote,
    serviceGeoPlace,
  ]);

  const scheduleError = useMemo(() => {
    if (type === "BORROW") {
      if (!borrowStart.trim() || !borrowEnd.trim()) return copy.timeRequiredError;
      if (!isBorrowRangeValid(borrowStart, borrowEnd)) return copy.borrowRangeError;
      if (
        !isDatetimeLocalNotPast(borrowStart) ||
        !isDatetimeLocalNotPast(borrowEnd)
      ) {
        return copy.timePastError;
      }
      return null;
    }
    if (type === "TASK") {
      if (!dueAt.trim()) return copy.timeRequiredError;
      if (!isDatetimeLocalNotPast(dueAt)) return copy.timePastError;
      return null;
    }
    if (type === "SERVICE") {
      if (!preferredAt.trim()) return copy.timeRequiredError;
      if (!isDatetimeLocalNotPast(preferredAt)) return copy.timePastError;
      return null;
    }
    return null;
  }, [type, borrowStart, borrowEnd, dueAt, preferredAt]);

  const canCore = useMemo(() => {
    if (!type || !Number.isFinite(price) || price <= 0) return false;
    if (type === "BUY") return Boolean(productQuery.trim());
    if (type === "BORROW") return Boolean(itemName.trim());
    if (type === "SERVICE") return Boolean(title.trim());
    return Boolean(detail.trim());
  }, [type, price, productQuery, title, itemName, detail]);

  const canSubmit = useMemo(() => {
    if (!canCore) return false;
    if (type === "TASK" && !taskMode) return false;
    if (type === "SERVICE" && !serviceMode) return false;
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
    taskMode,
    serviceMode,
  ]);

  async function submit() {
    setScheduleTouched(true);
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
            setFormError(copy.genericError);
            return;
          }
          pid = createdProduct.id;
          productName = createdProduct.name;
        }
        const created = await createDemand({
          type: "BUY",
          title: productName || rawName,
          productId: pid,
          maxPrice: price,
          conditionPreference: condition,
          fulfillmentOptions,
        });
        if (created && created.type === "BUY") {
          clearCreateDraft();
          navigate(`/demand/item/${created.id}`);
        } else {
          setFormError(copy.genericError);
        }
        return;
      }
      if (type === "BORROW") {
        const created = await createDemand({
          type: "BORROW",
          title: itemName.trim(),
          itemName: itemName.trim(),
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
          setFormError(copy.genericError);
        }
        return;
      }
      if (type === "TASK") {
        const taskTitle = detail.trim().split("\n")[0].slice(0, 60);
        const created = await createDemand({
          type: "TASK",
          title: taskTitle,
          taskDescription: detail.trim(),
          budget: price,
          fulfillmentOptions,
          dueAt: fromDatetimeLocalValue(dueAt),
        });
        if (created) {
          clearCreateDraft();
          navigate(`/demand/item/${created.id}`);
        } else {
          setFormError(copy.genericError);
        }
        return;
      }
      const durationDigits = digitsOnly(estimatedDuration);
      const durationMinutes = durationDigits
        ? Number.parseInt(durationDigits, 10)
        : undefined;
      const created = await createDemand({
        type: "SERVICE",
        title: title.trim(),
        serviceDescription: detail.trim() || title.trim(),
        description: detail.trim() || undefined,
        budget: price,
        fulfillmentOptions,
        preferredAt: fromDatetimeLocalValue(preferredAt),
        estimatedDurationMinutes:
          durationMinutes && Number.isFinite(durationMinutes)
            ? durationMinutes
            : undefined,
      });
      if (created) {
        clearCreateDraft();
        navigate(`/demand/item/${created.id}`);
      } else {
        setFormError(copy.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack page-narrow create-page">
      {locale === "ja" ? <p className="section-desc" role="note">試験運用中：表示・入力する金額は韓国ウォン（KRW）です。日本円での取引はまだ利用できません。</p> : null}
      <section className="create-page__body section-stack">
        <div className="create-page__prompt">
          <p className="create-page__kicker">
            {type ? `${phase} / 2` : "요청 유형"}
          </p>
          <h2 className="section-title">
            {!type
              ? copy.whatNeeded
              : phase === 1
                ? phase1Title(type)
                : phase2Title(type)}
          </h2>
        </div>

        {!type ? (
          <>
            <div className="request-type-grid" role="radiogroup" aria-label="요청 유형">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  className="request-type-card"
                  onClick={() => selectType(t)}
                >
                  <span className="request-type-card__icon" aria-hidden><RequestTypeIcon type={t} /></span>
                  <span className="request-type-card__copy">
                    <strong>{(locale === "ja" ? JP_TYPE_META : TYPE_META)[t].label}</strong>
                    <small>{(locale === "ja" ? JP_TYPE_META : TYPE_META)[t].desc}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="section-desc">{copy.pickDemandType}</p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="request-type-current"
              aria-label="요청 유형 변경"
              onClick={() => {
                setType(null);
                setPhase(1);
                setFormError(null);
              }}
            >
              <span className="request-type-current__icon" aria-hidden><RequestTypeIcon type={type} /></span>
              <span>
                <strong>{(locale === "ja" ? JP_TYPE_META : TYPE_META)[type].label}</strong>
                <small>요청 유형 변경</small>
              </span>
              <span className="request-type-current__chevron" aria-hidden>›</span>
            </button>
            <div className="create-progress" aria-label="작성 단계">
              <div className="create-progress__track"><span style={{ width: phase === 1 ? "50%" : "100%" }} /></div>
              <div className="create-progress__labels">
                <span className={phase === 1 ? "is-active" : ""}>무엇을</span>
                <span className={phase === 2 ? "is-active" : ""}>어디서 · 언제</span>
              </div>
            </div>

            {phase === 1 ? (
              <>
                {type === "BUY" ? (
                  <>
                    <div
                      className={
                        showProductSuggestions
                          ? "product-suggest is-open"
                          : "product-suggest"
                      }
                    >
                      <Field label={copy.productSearch} hint={copy.productSearchHint}>
                        <TextInput
                          value={productQuery}
                          onChange={(e) => {
                            setProductQuery(e.target.value);
                            setProductId("");
                            setSuggestOpen(e.target.value.trim().length > 0);
                          }}
                          onFocus={() => {
                            if (productQuery.trim().length > 0) setSuggestOpen(true);
                          }}
                          onBlur={() => {
                            window.setTimeout(() => setSuggestOpen(false), 120);
                          }}
                          placeholder={copy.productSearchPh}
                          autoComplete="off"
                        />
                      </Field>
                      {showProductSuggestions ? (
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
                      label={copy.maxPrice}
                      hint={copy.maxPriceHint}
                      value={maxPrice}
                      onChange={setMaxPrice}
                      placeholder="예: 800,000"
                      kind="buy"
                    />
                    <div>
                      <p className="field-inline-label">{copy.condition}</p>
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
                    <Field label={copy.itemName}>
                      <TextInput
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        placeholder="예: 캠핑 텐트"
                      />
                    </Field>
                    <MoneyInput
                      label={budgetLabelForType(type)}
                      hint={copy.borrowBudgetHint}
                      value={budget}
                      onChange={setBudget}
                      placeholder="예: 30,000"
                      kind="borrow"
                    />
                  </>
                ) : null}

                {type === "TASK" ? (
                  <>
                    <Field label={copy.descLabel}>
                      <textarea
                        className="dan-input dan-textarea"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder="예: 평택역에서 짐 옮겨주세요"
                        rows={3}
                      />
                    </Field>
                    <MoneyInput
                      label={budgetLabelForType(type)}
                      value={budget}
                      onChange={setBudget}
                      placeholder="예: 20,000"
                      kind="reward"
                    />
                  </>
                ) : null}

                {type === "SERVICE" ? (
                  <>
                    <Field label={copy.serviceTaskLabel}>
                      <TextInput
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={copy.serviceTaskPh}
                      />
                    </Field>
                    <MoneyInput
                      label={copy.reward}
                      value={budget}
                      onChange={setBudget}
                      placeholder="예: 1,000"
                      kind="reward"
                    />
                    <Field
                      label={copy.estimatedDuration}
                      hint={copy.estimatedDurationHint}
                    >
                      <TextInput
                        inputMode="numeric"
                        value={estimatedDuration}
                        onChange={(e) =>
                          setEstimatedDuration(digitsOnly(e.target.value))
                        }
                        placeholder={copy.estimatedDurationPh}
                      />
                    </Field>
                    <Field label={copy.serviceExtraLabel}>
                      <textarea
                        className="dan-input dan-textarea"
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder={copy.serviceExtraPh}
                        rows={2}
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : null}

            {phase === 2 ? (
              <>
                {type === "BUY" ? (
                  <>
                    <div>
                      <p className="field-inline-label">{copy.tradeMethod}</p>
                      <ChipGroup>
                        <Chip
                          selected={buyShipping}
                          onClick={() => setBuyShipping((v) => !v)}
                        >
                          {copy.buyShippingOpt}
                        </Chip>
                        <Chip
                          selected={buyMeetup}
                          onClick={() => setBuyMeetup((v) => !v)}
                        >
                          {copy.buyMeetupOpt}
                        </Chip>
                      </ChipGroup>
                    </div>
                    {buyMeetup ? (
                      <Field label={copy.buyMeetupWhere}>
                        <TextInput
                          value={meetupPlace}
                          onChange={(e) => setMeetupPlace(e.target.value)}
                          placeholder={copy.locationPh}
                        />
                      </Field>
                    ) : null}
                  </>
                ) : null}

                {type === "BORROW" ? (
                  <>
                    <Field label={copy.borrowWhere}>
                      <TextInput
                        value={borrowPlace}
                        onChange={(e) => setBorrowPlace(e.target.value)}
                        placeholder={copy.locationPh}
                      />
                    </Field>
                    <Field label={copy.borrowStart}>
                      <DatetimeLocalInput
                        value={borrowStart}
                        onChange={setBorrowStart}
                      />
                    </Field>
                    <Field label={copy.borrowEnd}>
                      <DatetimeLocalInput
                        value={borrowEnd}
                        onChange={setBorrowEnd}
                      />
                    </Field>
                    <Field label={copy.descLabel}>
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
                      <p className="field-inline-label">{copy.taskHow}</p>
                      <ChipGroup>
                        <Chip
                          selected={taskMode === "onsite"}
                          onClick={() => setTaskMode("onsite")}
                        >
                          {copy.taskModeOnsite}
                        </Chip>
                        <Chip
                          selected={taskMode === "pickup"}
                          onClick={() => setTaskMode("pickup")}
                        >
                          {copy.taskModePickup}
                        </Chip>
                        <Chip
                          selected={taskMode === "route"}
                          onClick={() => setTaskMode("route")}
                        >
                          {copy.taskModeRoute}
                        </Chip>
                        <Chip
                          selected={taskMode === "remote"}
                          onClick={() => setTaskMode("remote")}
                        >
                          {copy.taskModeRemote}
                        </Chip>
                      </ChipGroup>
                    </div>
                    {taskMode === "route" ? (
                      <div className="route-fields">
                        <Field label={copy.taskRouteFrom}>
                          <TextInput
                            value={routeFrom}
                            onChange={(e) => setRouteFrom(e.target.value)}
                            placeholder={copy.placePh}
                          />
                        </Field>
                        <span className="route-arrow" aria-hidden>
                          {copy.routeArrow}
                        </span>
                        <Field label={copy.taskRouteTo}>
                          <TextInput
                            value={routeTo}
                            onChange={(e) => setRouteTo(e.target.value)}
                            placeholder={copy.placePh}
                          />
                        </Field>
                      </div>
                    ) : null}
                    {taskMode === "onsite" || taskMode === "pickup" ? (
                      <Field
                        label={
                          taskMode === "pickup" ? copy.taskPickupPlace : copy.taskPlace
                        }
                      >
                        <TextInput
                          value={taskPlace}
                          onChange={(e) => setTaskPlace(e.target.value)}
                          placeholder={copy.locationPh}
                        />
                      </Field>
                    ) : null}
                    <Field label={copy.dueAt}>
                      <DatetimeLocalInput value={dueAt} onChange={setDueAt} />
                    </Field>
                  </div>
                ) : null}

                {type === "SERVICE" ? (
                  <div className="section-stack">
                    <div>
                      <p className="field-inline-label">{copy.fulfillHow}</p>
                      <ChipGroup>
                        <Chip
                          selected={serviceMode === "onsite"}
                          onClick={() => setServiceMode("onsite")}
                        >
                          {copy.serviceOnsite}
                        </Chip>
                        <Chip
                          selected={serviceMode === "remote"}
                          onClick={() => setServiceMode("remote")}
                        >
                          {copy.serviceRemote}
                        </Chip>
                      </ChipGroup>
                    </div>
                    {serviceMode === "onsite" ? (
                      <>
                        <div>
                          <p className="field-inline-label">{copy.whereNeeded}</p>
                          <div className="action-row action-row--split">
                            <Button
                              type="button"
                              variant="secondary"
                              fullWidth
                              disabled={geoBusy}
                              onClick={() => {
                                setGeoError(null);
                                setGeoBusy(true);
                                void requestCurrentPlace(servicePlaceNote).then(
                                  (result) => {
                                    setGeoBusy(false);
                                    if (!result.ok) {
                                      setGeoError(
                                        result.reason === "denied"
                                          ? copy.geoDenied
                                          : copy.geoFailed,
                                      );
                                      return;
                                    }
                                    setServiceGeoPlace(result.place);
                                    setServicePlace(
                                      result.place.region2 ??
                                        result.place.publicLabel,
                                    );
                                  },
                                );
                              }}
                            >
                              {geoBusy ? copy.geoLocating : copy.useCurrentLocation}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              fullWidth
                              onClick={() => {
                                setServiceGeoPlace(null);
                                setGeoError(null);
                              }}
                            >
                              {copy.enterPlaceManually}
                            </Button>
                          </div>
                          {geoError ? (
                            <p className="form-error">{geoError}</p>
                          ) : null}
                        </div>
                        <Field label={copy.placeAreaLabel}>
                          <TextInput
                            value={servicePlace}
                            onChange={(e) => {
                              setServicePlace(e.target.value);
                              setServiceGeoPlace(null);
                            }}
                            placeholder={copy.locationPh}
                          />
                        </Field>
                        <Field label={copy.placeNoteLabel}>
                          <TextInput
                            value={servicePlaceNote}
                            onChange={(e) => setServicePlaceNote(e.target.value)}
                            placeholder={copy.placeNotePh}
                          />
                        </Field>
                      </>
                    ) : null}
                    <Field label={copy.preferredAt}>
                      <DatetimeLocalInput
                        value={preferredAt}
                        onChange={setPreferredAt}
                      />
                    </Field>
                  </div>
                ) : null}

                {formError || (scheduleTouched && scheduleError) ? (
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
              {copy.stepNext}
            </Button>
          ) : (
            <div className="action-row create-page__actions">
              <Button variant="secondary" fullWidth onClick={() => setPhase(1)}>
                {copy.stepPrev}
              </Button>
              <Button
                fullWidth
                size="lg"
                onClick={() => void submit()}
                disabled={!canSubmit || submitting}
              >
                {submitting
                  ? copy.saving
                  : isLoggedIn
                    ? copy.submitDemand
                    : copy.submitNeedLogin}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
