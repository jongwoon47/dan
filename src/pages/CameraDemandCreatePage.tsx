import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import { placeFromLabel } from "@/domain/fulfillment";
import type { ConditionPreference } from "@/domain/types";
import { formatDigitsGrouped, digitsOnly, parseMoneyInput } from "@/lib/format";
import "./pages.css";

const PILOT_MODELS = [
  "Fujifilm X100VI",
  "Fujifilm X100V",
  "Ricoh GR III",
  "Ricoh GR IIIx",
  "Sony RX100 VII",
];

const CONDITION_OPTIONS: Array<{ value: ConditionPreference; label: string }> = [
  { value: "any", label: "상관없음" },
  { value: "lightly_used", label: "사용감 적음 이상" },
  { value: "like_new", label: "거의 새것 이상" },
];

export function CameraDemandCreatePage() {
  const { products, createDemand, currentUser, isLoggedIn } = useDan();
  const navigate = useNavigate();
  const pilotProducts = useMemo(
    () =>
      PILOT_MODELS.map((name) => products.find((p) => p.name === name)).filter(
        (p): p is NonNullable<typeof p> => Boolean(p),
      ),
    [products],
  );
  const [productId, setProductId] = useState(pilotProducts[0]?.id ?? "");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState<ConditionPreference>("any");
  const [area, setArea] = useState(currentUser?.defaultArea || "서울");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useDeepHeader({ title: "구매수요 등록" });

  const selected = pilotProducts.find((p) => p.id === productId);
  const price = parseMoneyInput(maxPrice);
  const canSubmit = Boolean(selected && price > 0 && area.trim());

  async function submit() {
    if (!canSubmit || !selected || submitting) return;
    if (!isLoggedIn) {
      navigate("/login?next=/buy/new");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const created = await createDemand({
        type: "BUY",
        title: selected.name,
        description: `${selected.name} 구매수요 · ${area.trim()} 직거래`,
        productId: selected.id,
        maxPrice: price,
        conditionPreference: condition,
        tradeMethod: "meetup",
        fulfillmentOptions: [
          { mode: "MEETUP", place: placeFromLabel(area.trim()) },
        ],
      });
      if (!created) {
        setError("구매수요를 등록하지 못했어요.");
        return;
      }
      navigate(`/demand/item/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack page-narrow camera-demand-create">
      <section className="create-v1-intro">
        <span className="eyebrow">Live Demand</span>
        <h1 className="page-title">사고 싶은 조건만 남겨주세요.</h1>
        <p>매물을 계속 찾지 않아도, 이 물건을 가진 사람이 수요를 보고 직접 제안할 수 있어요.</p>
      </section>

      <section className="section-stack">
        <div>
          <p className="field-inline-label">모델</p>
          <div className="camera-model-grid">
            {pilotProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className={productId === product.id ? "camera-model-option is-selected" : "camera-model-option"}
                onClick={() => setProductId(product.id)}
              >
                <ProductVisual product={product} size="sm" />
                <span>{product.name}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="최대 구매 희망가" hint="이 금액 이하라면 실제로 구매를 검토할 가격이에요.">
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(maxPrice)}
            onChange={(e) => setMaxPrice(digitsOnly(e.target.value))}
            placeholder="예: 2,150,000"
          />
        </Field>

        <div>
          <p className="field-inline-label">상태 조건</p>
          <div className="condition-option-row">
            {CONDITION_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={condition === option.value ? "condition-option is-selected" : "condition-option"}
                onClick={() => setCondition(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="직거래 지역">
          <TextInput value={area} onChange={(e) => setArea(e.target.value)} placeholder="예: 서울" />
        </Field>

        <div className="live-demand-rule">
          <strong>구매수요는 계속 살아 있지 않아요.</strong>
          <p>현재 시스템의 만료 정책에 따라 일정 기간 후 다시 확인하며, 만료된 수요는 공개 집계에서 빠집니다.</p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        <Button fullWidth size="lg" disabled={!canSubmit || submitting} onClick={() => void submit()}>
          {submitting ? "등록 중…" : "구매수요 등록하기"}
        </Button>
      </section>
    </div>
  );
}
