import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, Field, TextInput, TextSelect } from "@/components/ui/Input";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import { placeFromLabel } from "@/domain/fulfillment";
import {
  filterProductSuggestions,
  productMatchKey,
} from "@/domain/productName";
import {
  CATEGORY_LABEL,
  CONDITION_LABEL,
  PRODUCT_CATEGORY_OPTIONS,
  TRADE_LABEL,
  type ConditionPreference,
  type ProductCategory,
  type TradeMethod,
} from "@/domain/types";
import {
  formatDigitsGrouped,
  digitsOnly,
  formatWon,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

const CONDITION_OPTIONS: ConditionPreference[] = [
  "any",
  "lightly_used",
  "like_new",
  "sealed",
];

const PREFERENCE_PLACEHOLDER: Partial<Record<ProductCategory, string>> = {
  electronics: "예: 256GB, 블랙, 배터리 90% 이상",
  computer: "예: RAM 16GB 이상, SSD 512GB, 스페이스 블랙",
  gaming: "예: 정발판, 박스 포함, 추가 패드 포함",
  audio: "예: 블랙, 정품 케이블 포함, 패드 상태 양호",
  camera: "예: 블랙, 1만컷 이하, 풀박스",
  lens: "예: 정품 후드 포함, 곰팡이·헤이즈 없음",
  home_appliance: "예: 2024년 이후 구매, 구성품 포함",
  furniture: "예: B사이즈, 그래파이트, 헤드레스트 포함",
  fashion: "예: M 사이즈, 블랙, 택 포함",
  shoes: "예: 270mm, 박스 포함",
  watches_accessories: "예: 풀세트, 여분 링크 포함",
  sports: "예: M 사이즈, 실사용 적음",
  outdoor: "예: 2인용, 풋프린트 포함",
  camping: "예: 2인용, 풋프린트 포함",
  hobby_collectible: "예: 미개봉, 한글판",
  baby_kids: "예: 2025년식, 구성품 전체",
  books_media: "예: 전권, 낙서 없음",
  musical_instrument: "예: 소프트케이스 포함, 수리 이력 없음",
  beauty: "예: 미개봉, 사용기한 1년 이상",
  pet: "예: M 사이즈, 세척 완료",
  tools: "예: 배터리 2개, 충전기 포함",
  auto: "예: 신형, 장착 부품 포함",
  other: "예: 색상, 사이즈, 용량, 구성품",
};

const TRADE_OPTIONS: TradeMethod[] = ["meetup", "shipping", "any"];

export function BuyDemandCreatePage() {
  const {
    products,
    createDemand,
    ensureProduct,
    currentUser,
    isLoggedIn,
    getMyVerification,
  } = useDan();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q")?.trim() ?? "";

  const [productQuery, setProductQuery] = useState(initialQuery);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [category, setCategory] = useState<ProductCategory>("other");
  const [maxPrice, setMaxPrice] = useState("");
  const [condition, setCondition] = useState<ConditionPreference>("any");
  const [tradeMethod, setTradeMethod] = useState<TradeMethod>("meetup");
  const [area, setArea] = useState(currentUser?.defaultArea || "서울");
  const [extraCondition, setExtraCondition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationLoaded, setVerificationLoaded] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useDeepHeader({ title: "구매수요 등록" });

  useEffect(() => {
    if (!initialQuery || selectedProductId || productQuery !== initialQuery) return;
    const exact = products.find(
      (product) => productMatchKey(product.name) === productMatchKey(initialQuery),
    );
    if (!exact) return;
    setSelectedProductId(exact.id);
    setProductQuery(exact.name);
    setCategory(exact.category);
  }, [initialQuery, productQuery, products, selectedProductId]);

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
    return (
    <div className="page-stack page-narrow camera-demand-create camera-demand-create--blueprint">
      <section className="create-v1-intro">
        <span className="eyebrow">Live Demand</span>
        <h1 className="page-title">
          {step === 1
            ? "무엇을 사고 싶나요?"
            : step === 2
              ? "어떤 조건이면 살까요?"
              : "이 조건으로 사람을 찾아볼게요."}
        </h1>
        <p>
          {step === 1
            ? "제품을 먼저 고르세요. 목록에 없어도 직접 입력할 수 있어요."
            : step === 2
              ? "가격·상태·거래 방식만 정하면 끝이에요."
              : "공개될 구매수요를 마지막으로 확인해 주세요."}
        </p>
      </section>

      <div className="create-stepper" aria-label="구매수요 등록 단계">
        {(["제품", "조건", "확인"] as const).map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          return (
            <span
              key={label}
              className={number === step ? "is-current" : number < step ? "is-done" : ""}
            >
              <i>{number < step ? "✓" : number}</i>
              <b>{label}</b>
            </span>
          );
        })}
      </div>

      {step === 1 ? (
        <>
          <section className="product-search-section">
            <Field
              label="찾는 제품"
              hint="제품이 목록에 없어도 입력한 이름으로 새 구매수요를 만들 수 있어요."
            >
              <TextInput
                value={productQuery}
                onChange={(event) => changeQuery(event.target.value)}
                placeholder="예: iPhone 15 Pro, 에어론 체어, Switch OLED"
                autoComplete="off"
              />
            </Field>

            {productQuery.trim() && suggestions.length > 0 && !queryMatchesSelected ? (
              <div className="product-suggestion-list" role="listbox" aria-label="제품 검색 결과">
                {suggestions.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="product-suggestion"
                    onClick={() => chooseProduct(product.id)}
                  >
                    <ProductVisual product={product} size="sm" />
                    <span>
                      <strong>{product.name}</strong>
                      <small>{product.brand || CATEGORY_LABEL[product.category]}</small>
                    </span>
                    <span aria-hidden>›</span>
                  </button>
                ))}
              </div>
            ) : null}

            {productQuery.trim().length >= 2 && !exactCatalogMatch && !queryMatchesSelected ? (
              <div className="new-product-hint">
                <span>검색 결과에 없어도 괜찮아요.</span>
                <strong>‘{productQuery.trim()}’로 새 제품 수요를 만들 수 있어요.</strong>
              </div>
            ) : null}

            {queryMatchesSelected && selectedProduct ? (
              <div className="selected-product-card">
                <ProductVisual product={selectedProduct} size="sm" />
                <div>
                  <span>선택한 제품</span>
                  <strong>{selectedProduct.name}</strong>
                  <small>{CATEGORY_LABEL[selectedProduct.category]}</small>
                </div>
              </div>
            ) : (
              <Field label="제품 카테고리" hint="새 제품으로 등록될 때 사용할 분류예요.">
                <TextSelect
                  value={category}
                  onChange={(event) => setCategory(event.target.value as ProductCategory)}
                >
                  {PRODUCT_CATEGORY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {CATEGORY_LABEL[item]}
                    </option>
                  ))}
                </TextSelect>
              </Field>
            )}
          </section>

          <Button
            fullWidth
            size="lg"
            disabled={!productQuery.trim()}
            onClick={() => {
              setError("");
              setStep(2);
            }}
          >
            조건 입력하기
          </Button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <section className="selected-product-card create-selected-product">
            {selectedProduct ? <ProductVisual product={selectedProduct} size="sm" /> : null}
            <div>
              <span>찾는 제품</span>
              <strong>{productQuery.trim()}</strong>
              <small>{CATEGORY_LABEL[selectedProduct?.category ?? category]}</small>
            </div>
          </section>

          <Field
            label="최대 구매 희망가"
            hint="이 금액 이하라면 실제로 구매를 검토할 가격이에요."
          >
            <TextInput
              inputMode="numeric"
              value={formatDigitsGrouped(maxPrice)}
              onChange={(event) => setMaxPrice(digitsOnly(event.target.value))}
              placeholder="예: 850,000"
            />
          </Field>

          <section className="demand-condition-section">
            <div className="demand-condition-heading">
              <h2>필수 조건</h2>
              <span>거래 가능한 범위</span>
            </div>

            <div>
              <p className="field-inline-label">물품 상태</p>
              <ChipGroup>
                {CONDITION_OPTIONS.map((item) => (
                  <Chip
                    key={item}
                    selected={condition === item}
                    onClick={() => setCondition(item)}
                  >
                    {CONDITION_LABEL[item]}
                  </Chip>
                ))}
              </ChipGroup>
            </div>

            <div>
              <p className="field-inline-label">거래 방식</p>
              <ChipGroup>
                {TRADE_OPTIONS.map((item) => (
                  <Chip
                    key={item}
                    selected={tradeMethod === item}
                    onClick={() => setTradeMethod(item)}
                  >
                    {TRADE_LABEL[item]}
                  </Chip>
                ))}
              </ChipGroup>
            </div>

            {meetupNeeded ? (
              <Field label="직거래 지역">
                <TextInput
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder="예: 서울 강남"
                />
              </Field>
            ) : null}
          </section>

          <Field
            label="추가로 원하는 조건"
            hint="선택 입력 · 색상, 사이즈, 용량, 구성품처럼 중요한 조건만 적어주세요."
          >
            <TextInput
              value={extraCondition}
              onChange={(event) => setExtraCondition(event.target.value)}
              placeholder={PREFERENCE_PLACEHOLDER[selectedProduct?.category ?? category] ?? PREFERENCE_PLACEHOLDER.other}
            />
          </Field>

          <div className="create-actions">
            <Button fullWidth variant="secondary" onClick={() => setStep(1)}>
              이전
            </Button>
            <Button
              fullWidth
              size="lg"
              disabled={!canSubmit}
              onClick={() => {
                setError("");
                setStep(3);
              }}
            >
              확인하기
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <section className="demand-review-card">
            <div className="demand-review-card__product">
              {selectedProduct ? <ProductVisual product={selectedProduct} size="sm" /> : null}
              <div>
                <span>구매수요</span>
                <strong>{productQuery.trim()}</strong>
                <small>{CATEGORY_LABEL[selectedProduct?.category ?? category]}</small>
              </div>
            </div>
            <dl>
              <div><dt>최대 희망가</dt><dd>{formatWon(price)}</dd></div>
              <div><dt>상태</dt><dd>{CONDITION_LABEL[condition]}</dd></div>
              <div><dt>거래 방식</dt><dd>{TRADE_LABEL[tradeMethod]}</dd></div>
              {meetupNeeded ? <div><dt>직거래 지역</dt><dd>{area.trim()}</dd></div> : null}
              {extraCondition.trim() ? <div><dt>추가 조건</dt><dd>{extraCondition.trim()}</dd></div> : null}
            </dl>
          </section>

          <div className="live-demand-rule">
            <strong>구매수요는 7일 단위로 다시 확인해요.</strong>
            <p>
              오래된 수요가 계속 노출되지 않도록 실제 구매 의사를 주기적으로 확인합니다.
            </p>
          </div>

          {isLoggedIn && verificationLoaded && !phoneVerified ? (
            <div className="verification-gate">
              <strong>휴대폰 본인확인이 필요해요</strong>
              <p>
                공개 구매수요와 희망가는 실제 구매 의사가 확인된 계정만 Live Demand에 반영합니다.
              </p>
            </div>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}

          <div className="create-actions">
            <Button fullWidth variant="secondary" onClick={() => setStep(2)}>
              조건 수정
            </Button>
            <Button
              fullWidth
              size="lg"
              disabled={
                !canSubmit ||
                submitting ||
                (isLoggedIn && verificationLoaded && !phoneVerified)
              }
              onClick={() => void submit()}
            >
              {submitting ? "등록 중…" : "구매수요 등록"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
