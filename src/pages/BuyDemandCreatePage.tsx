import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, Field, TextInput, TextSelect } from "@/components/ui/Input";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import { placeFromLabel } from "@/domain/fulfillment";
import {
  filterProductSuggestions,
  productMatchKey,
} from "@/domain/productName";
import {
  PRODUCT_CATEGORY_OPTIONS,
  type ConditionPreference,
  type ProductCategory,
  type TradeMethod,
} from "@/domain/types";
import { categoryLabel, conditionLabel, tradeLabel } from "@/i18n/categories";
import { useDanLocale } from "@/i18n/locale";
import {
  formatDigitsGrouped,
  formatStoredMoney,
  digitsOnly,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

const CONDITION_OPTIONS: ConditionPreference[] = [
  "any",
  "lightly_used",
  "like_new",
  "sealed",
];

const PREFERENCE_PLACEHOLDER_KO: Partial<Record<ProductCategory, string>> = {
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

const PREFERENCE_PLACEHOLDER_JA: Partial<Record<ProductCategory, string>> = {
  electronics: "例: 256GB、ブラック、バッテリー90%以上",
  computer: "例: RAM 16GB以上、SSD 512GB、スペースブラック",
  gaming: "例: 国内版、箱あり、追加パッドあり",
  audio: "例: ブラック、純正ケーブルあり、パッド良好",
  camera: "例: ブラック、1万カット以下、フルセット",
  lens: "例: 純正フードあり、カビ・曇りなし",
  home_appliance: "例: 2024年以降購入、付属品あり",
  furniture: "例: Bサイズ、グラファイト、ヘッドレストあり",
  fashion: "例: Mサイズ、ブラック、タグあり",
  shoes: "例: 27.0cm、箱あり",
  watches_accessories: "例: フルセット、余リンクあり",
  sports: "例: Mサイズ、使用少なめ",
  outdoor: "例: 2人用、グランドシートあり",
  camping: "例: 2人用、グランドシートあり",
  hobby_collectible: "例: 未開封、日本語版",
  baby_kids: "例: 2025年式、付属品すべて",
  books_media: "例: 全巻、書き込みなし",
  musical_instrument: "例: ソフトケースあり、修理歴なし",
  beauty: "例: 未開封、使用期限1年以上",
  pet: "例: Mサイズ、洗浄済み",
  tools: "例: バッテリー2個、充電器あり",
  auto: "例: 新型、取付部品あり",
  other: "例: 色、サイズ、容量、付属品",
};

const TRADE_OPTIONS: TradeMethod[] = ["meetup", "shipping", "any"];

export function BuyDemandCreatePage() {
  const locale = useDanLocale();
  const copy = useDanCopy();
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
  const [area, setArea] = useState(
    currentUser?.defaultArea || copy.defaultAreaSeoul,
  );
  const [extraCondition, setExtraCondition] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationLoaded, setVerificationLoaded] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useDeepHeader({
    title: copy.buyDemandTitle,
    onBack: reviewing ? () => setReviewing(false) : undefined,
    backKey: reviewing,
  });

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
      setVerificationLoaded((prev) => (prev ? false : prev));
      setPhoneVerified((prev) => (prev ? false : prev));
      return;
    }
    let cancelled = false;
    void getMyVerification()
      .then((status) => {
        if (cancelled) return;
        setPhoneVerified(status.phoneVerified);
        setVerificationLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPhoneVerified(false);
        setVerificationLoaded(true);
        setError(copy.genericError);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.genericError, getMyVerification, isLoggedIn]);

  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const suggestions = useMemo(
    () => filterProductSuggestions(products, productQuery, 6),
    [products, productQuery],
  );
  const queryMatchesSelected = Boolean(
    selectedProduct &&
      productMatchKey(selectedProduct.name) === productMatchKey(productQuery),
  );
  const exactCatalogMatch = suggestions.find(
    (product) => productMatchKey(product.name) === productMatchKey(productQuery),
  );

  const price = parseMoneyInput(maxPrice);
  const meetupNeeded = tradeMethod === "meetup" || tradeMethod === "any";
  const canSubmit = Boolean(
    productQuery.trim() &&
      price > 0 &&
      (!meetupNeeded || area.trim()),
  );

  function chooseProduct(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setSelectedProductId(product.id);
    setProductQuery(product.name);
    setCategory(product.category);
    setError("");
  }

  function changeQuery(value: string) {
    setProductQuery(value);
    if (
      selectedProduct &&
      productMatchKey(selectedProduct.name) !== productMatchKey(value)
    ) {
      setSelectedProductId("");
    }
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    if (!isLoggedIn) {
      navigate("/login?next=/buy/new");
      return;
    }
    if (!phoneVerified) {
      setError(copy.buyDemandPhoneRequired);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const product =
        queryMatchesSelected && selectedProduct
          ? selectedProduct
          : exactCatalogMatch ??
            (await ensureProduct(productQuery.trim(), category));

      if (!product) {
        setError(copy.buyDemandProductCreateFail);
        return;
      }

      const fulfillmentOptions =
        tradeMethod === "shipping"
          ? [{ mode: "SHIPPING" as const }]
          : tradeMethod === "any"
            ? [
                { mode: "SHIPPING" as const },
                { mode: "MEETUP" as const, place: placeFromLabel(area.trim()) },
              ]
            : [
                { mode: "MEETUP" as const, place: placeFromLabel(area.trim()) },
              ];

      const preferenceText = extraCondition.trim()
        ? `${copy.buyDemandExtraPrefix}${extraCondition.trim()}`
        : "";

      const created = await createDemand({
        type: "BUY",
        title: product.name,
        description: `${product.name} ${copy.buyDemandDescSuffix}${preferenceText}`,
        productId: product.id,
        maxPrice: price,
        conditionPreference: condition,
        tradeMethod,
        fulfillmentOptions,
      });

      if (!created) {
        setError(copy.buyDemandCreateFail);
        return;
      }
      navigate("/my?tab=demands");
    } catch {
      setError(copy.buyDemandCreateFail);
    } finally {
      setSubmitting(false);
    }
  }

  if (reviewing) {
    return (
      <div className="page-stack page-narrow camera-demand-create camera-demand-create--blueprint">
        <section className="create-v1-intro">
          <span className="eyebrow">{copy.buyDemandStepReview}</span>
          <h2 className="page-title">{copy.buyDemandReviewTitle}</h2>
          <p>{copy.buyDemandReviewBody}</p>
        </section>

        <section className="deal-snapshot-card demand-create-review">
          <div className="snapshot-section">
            <span>{copy.product}</span>
            <strong>{productQuery.trim()}</strong>
          </div>
          <div className="snapshot-section">
            <span>{copy.buyDemandMaxPrice}</span>
            <strong>{formatStoredMoney(price, "KRW", locale)}</strong>
          </div>
          <div className="snapshot-section">
            <span>{copy.buyDemandAllowedCondition}</span>
            <strong>{conditionLabel(locale, condition)}</strong>
          </div>
          <div className="snapshot-section">
            <span>{copy.tradeMethod}</span>
            <strong>{tradeLabel(locale, tradeMethod)}</strong>
          </div>
          {meetupNeeded ? (
            <div className="snapshot-section">
              <span>{copy.buyDemandMeetupArea}</span>
              <strong>{area.trim()}</strong>
            </div>
          ) : null}
          {extraCondition.trim() ? (
            <div className="snapshot-section">
              <span>{copy.buyDemandExtraShort}</span>
              <strong>{extraCondition.trim()}</strong>
            </div>
          ) : null}
        </section>

        <div className="live-demand-rule">
          <strong>{copy.buyDemandLiveRuleTitle}</strong>
          <p>{copy.buyDemandLiveRuleBody}</p>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="create-review-actions">
          <Button fullWidth size="lg" disabled={submitting} onClick={() => void submit()}>
            {submitting ? copy.buyDemandSubmitting : copy.buyDemandSubmitCta}
          </Button>
          <Button fullWidth variant="secondary" disabled={submitting} onClick={() => setReviewing(false)}>
            {copy.buyDemandEditConditions}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack page-narrow camera-demand-create camera-demand-create--blueprint">
      <section className="create-v1-intro">
        <span className="eyebrow">{copy.buyDemandStepInput}</span>
        <h2 className="page-title">{copy.buyDemandLeadTitle}</h2>
        <p>{copy.buyDemandLeadBody}</p>
        {locale === "ja" ? (
          <p className="section-desc" role="note">
            試験運用中：表示・入力する金額は韓国ウォン（KRW）です。日本円での取引はまだ利用できません。
          </p>
        ) : null}
      </section>

      <section className="product-search-section commerce-panel commerce-panel--product">
        <Field label={copy.productSearch} hint={copy.buyDemandProductHint}>
          <TextInput
            value={productQuery}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder={copy.buyDemandProductPh}
            autoComplete="off"
          />
        </Field>

        {productQuery.trim() && suggestions.length > 0 && !queryMatchesSelected ? (
          <div
            className="product-suggestion-list"
            role="listbox"
            aria-label={copy.buyDemandSuggestAria}
          >
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
                  <small>{product.brand || categoryLabel(locale, product.category)}</small>
                </span>
                <span aria-hidden>›</span>
              </button>
            ))}
          </div>
        ) : null}

        {productQuery.trim().length >= 2 && !exactCatalogMatch && !queryMatchesSelected ? (
          <div className="new-product-hint">
            <span>{copy.buyDemandNewProductHint}</span>
            <strong>
              {copy.buyDemandNewProductMake.replace("{name}", productQuery.trim())}
            </strong>
          </div>
        ) : null}

        {queryMatchesSelected && selectedProduct ? (
          <div className="selected-product-card">
            <ProductVisual product={selectedProduct} size="sm" />
            <div>
              <span>{copy.buyDemandSelectedProduct}</span>
              <strong>{selectedProduct.name}</strong>
              <small>{categoryLabel(locale, selectedProduct.category)}</small>
            </div>
          </div>
        ) : (
          <Field label={copy.buyDemandCategory} hint={copy.buyDemandCategoryHint}>
            <TextSelect
              value={category}
              onChange={(event) => setCategory(event.target.value as ProductCategory)}
            >
              {PRODUCT_CATEGORY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {categoryLabel(locale, item)}
                </option>
              ))}
            </TextSelect>
          </Field>
        )}
      </section>

      <section className="commerce-panel commerce-panel--price">
        <Field label={copy.buyDemandMaxPrice} hint={copy.buyDemandMaxPriceHint}>
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(maxPrice, locale)}
            onChange={(event) => setMaxPrice(digitsOnly(event.target.value))}
            placeholder={copy.buyDemandMaxPricePh}
          />
        </Field>
      </section>

      <section className="demand-condition-section commerce-panel">
        <div className="demand-condition-heading">
          <h2>{copy.buyDemandRequiredTitle}</h2>
          <span>{copy.buyDemandRequiredSub}</span>
        </div>

        <div>
          <p className="field-inline-label">{copy.buyDemandItemCondition}</p>
          <ChipGroup>
            {CONDITION_OPTIONS.map((item) => (
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
          <p className="field-inline-label">{copy.tradeMethod}</p>
          <ChipGroup>
            {TRADE_OPTIONS.map((item) => (
              <Chip
                key={item}
                selected={tradeMethod === item}
                onClick={() => setTradeMethod(item)}
              >
                {tradeLabel(locale, item)}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        {meetupNeeded ? (
          <Field label={copy.buyDemandMeetupArea}>
            <TextInput
              value={area}
              onChange={(event) => setArea(event.target.value)}
              placeholder={copy.buyDemandMeetupAreaPh}
            />
          </Field>
        ) : null}
      </section>

      <section className="demand-condition-section commerce-panel commerce-panel--optional">
        <div className="demand-condition-heading">
          <h2>{copy.buyDemandPrefTitle}</h2>
          <span>{copy.buyDemandPrefSub}</span>
        </div>
        <Field label={copy.buyDemandExtraLabel} hint={copy.buyDemandExtraHint}>
          <TextInput
            value={extraCondition}
            onChange={(event) => setExtraCondition(event.target.value)}
            placeholder={
              (locale === "ja" ? PREFERENCE_PLACEHOLDER_JA : PREFERENCE_PLACEHOLDER_KO)[
                selectedProduct?.category ?? category
              ] ??
              (locale === "ja" ? PREFERENCE_PLACEHOLDER_JA : PREFERENCE_PLACEHOLDER_KO).other
            }
          />
        </Field>
      </section>

      <div className="live-demand-rule">
        <strong>{copy.buyDemandRefreshRuleTitle}</strong>
        <p>{copy.buyDemandRefreshRuleBody}</p>
      </div>

      {isLoggedIn && verificationLoaded && !phoneVerified ? (
        <div className="verification-gate">
          <strong>{copy.buyDemandPhoneGateTitle}</strong>
          <p>{copy.buyDemandPhoneGateBody}</p>
        </div>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="create-sticky-action">
        <Button
          fullWidth
          size="lg"
          disabled={
            !canSubmit ||
            submitting ||
            (isLoggedIn && verificationLoaded && !phoneVerified)
          }
          onClick={() => {
            setError("");
            setReviewing(true);
          }}
        >
          {copy.buyDemandNextReview}
        </Button>
      </div>
    </div>
  );
}
