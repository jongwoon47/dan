import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, TextSelect } from "@/components/ui/Input";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import { DAN_V1_CAMERA_NAMES } from "@/domain/danV1";
import { placeFromLabel } from "@/domain/fulfillment";
import type { ConditionPreference } from "@/domain/types";
import { formatDigitsGrouped, digitsOnly, parseMoneyInput } from "@/lib/format";
import "./pages.css";

const CONDITION_OPTIONS: Array<{ value: ConditionPreference; label: string }> = [
  { value: "any", label: "상관없음" },
  { value: "lightly_used", label: "사용감 적음 이상" },
  { value: "like_new", label: "거의 새것 이상" },
];
const PREFERENCE_OPTIONS = ["국내정품", "3,000컷 이하", "풀박스", "보증 잔여"] as const;

export function CameraDemandCreatePage() {
  const { products, createDemand, currentUser, isLoggedIn, getMyVerification } = useDan();
  const navigate = useNavigate();
  const pilotProducts = useMemo(
    () => DAN_V1_CAMERA_NAMES.map((name) => products.find((p) => p.name === name)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [products],
  );
  const [productId, setProductId] = useState(pilotProducts[0]?.id ?? "");
  const [color, setColor] = useState("Black");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState<ConditionPreference>("any");
  const [area, setArea] = useState(currentUser?.defaultArea || "서울");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [verificationLoaded, setVerificationLoaded] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [error, setError] = useState("");

  useDeepHeader({ title: "구매수요 등록" });

  useEffect(() => {
    if (!isLoggedIn) {
      setVerificationLoaded(false);
      setPhoneVerified(false);
      return;
    }
    let cancelled = false;
    void getMyVerification().then((status) => {
      if (cancelled) return;
      setPhoneVerified(status.phoneVerified);
      setVerificationLoaded(true);
    });
    return () => { cancelled = true; };
  }, [getMyVerification, isLoggedIn]);

  const selected = pilotProducts.find((p) => p.id === productId);
  const price = parseMoneyInput(maxPrice);
  const canSubmit = Boolean(selected && price > 0 && area.trim());

  function togglePreference(value: string) {
    setPreferences((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function submit() {
    if (!canSubmit || !selected || submitting) return;
    if (!isLoggedIn) {
      navigate("/login?next=/buy/new");
      return;
    }
    if (!phoneVerified) {
      setError("Live Demand를 공개하려면 휴대폰 본인확인이 필요해요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const preferenceText = preferences.length > 0 ? ` · 선호: ${preferences.join(", ")}` : "";
      const created = await createDemand({
        type: "BUY",
        title: `${selected.name} ${color}`,
        description: `${selected.name} ${color} 구매수요 · ${area.trim()} 직거래${preferenceText}`,
        productId: selected.id,
        maxPrice: price,
        conditionPreference: condition,
        tradeMethod: "meetup",
        fulfillmentOptions: [{ mode: "MEETUP", place: placeFromLabel(area.trim()) }],
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
    <div className="page-stack page-narrow camera-demand-create camera-demand-create--blueprint">
      <section className="create-v1-intro">
        <span className="eyebrow">Live Demand</span>
        <h1 className="page-title">원하는 조건만 간단하게 남겨주세요.</h1>
        <p>등록하면 이 카메라를 가진 사람이 구매수요를 보고 직접 제안할 수 있어요.</p>
      </section>

      <section className="camera-demand-card">
        {selected ? <ProductVisual product={selected} size="lg" /> : null}
        <div className="camera-demand-fields">
          <Field label="모델">
            <TextSelect value={productId} onChange={(event) => setProductId(event.target.value)}>
              {pilotProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </TextSelect>
          </Field>
          <Field label="색상">
            <TextSelect value={color} onChange={(event) => setColor(event.target.value)}>
              <option value="Black">Black</option>
              <option value="Silver">Silver</option>
            </TextSelect>
          </Field>
          <Field label="최대 구매 희망가" hint="이 금액 이하라면 실제로 구매를 검토할 가격이에요.">
            <TextInput inputMode="numeric" value={formatDigitsGrouped(maxPrice)} onChange={(e) => setMaxPrice(digitsOnly(e.target.value))} placeholder="예: 2,150,000" />
          </Field>
        </div>
      </section>

      <section className="demand-condition-section">
        <div className="demand-condition-heading"><h2>필수 조건</h2><span>반드시 충족</span></div>
        <div className="demand-condition-list">
          <div className="demand-condition-row"><span className="demand-check" aria-hidden>✓</span><span>정상 작동</span><strong>필수</strong></div>
          <label className="demand-condition-row demand-condition-row--field">
            <span className="demand-check" aria-hidden>✓</span><span>거래지역</span>
            <TextInput value={area} onChange={(e) => setArea(e.target.value)} placeholder="예: 서울" aria-label="직거래 지역" />
          </label>
          <div className="demand-condition-row"><span className="demand-check" aria-hidden>✓</span><span>거래방식</span><strong>직거래</strong></div>
        </div>
      </section>

      <section className="demand-condition-section">
        <div className="demand-condition-heading"><h2>선호 조건</h2><span>있으면 좋아요</span></div>
        <div className="preference-check-grid">
          {PREFERENCE_OPTIONS.map((item) => (
            <button key={item} type="button" className={preferences.includes(item) ? "preference-check is-selected" : "preference-check"} onClick={() => togglePreference(item)} aria-pressed={preferences.includes(item)}>
              <span aria-hidden>{preferences.includes(item) ? "✓" : ""}</span>{item}
            </button>
          ))}
        </div>
        <div>
          <p className="field-inline-label">상태 기준</p>
          <div className="condition-option-row">
            {CONDITION_OPTIONS.map((option) => (
              <button key={option.value} type="button" className={condition === option.value ? "condition-option is-selected" : "condition-option"} onClick={() => setCondition(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="live-demand-rule">
        <strong>구매수요는 7일 단위로 다시 확인해요.</strong>
        <p>오래된 수요가 계속 노출되지 않도록 실제 구매 의사를 주기적으로 확인합니다.</p>
      </div>

      {isLoggedIn && verificationLoaded && !phoneVerified ? (
        <div className="verification-gate">
          <strong>휴대폰 본인확인이 필요해요</strong>
          <p>공개 구매수요와 최고 희망가는 실제 구매 의사가 있는 계정만 반영하도록 검증된 계정만 Live Demand를 만들 수 있어요.</p>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      <Button fullWidth size="lg" disabled={!canSubmit || submitting || (isLoggedIn && verificationLoaded && !phoneVerified)} onClick={() => void submit()}>
        {submitting ? "등록 중…" : "구매수요 등록하기"}
      </Button>
    </div>
  );
}
