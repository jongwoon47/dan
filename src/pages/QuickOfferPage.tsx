import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, Field, TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { ItemCondition, Ownership, TradeMethod } from "@/domain/types";
import { CONDITION_LABEL } from "@/domain/types";
import {
  digitsOnly,
  formatDigitsGrouped,
  formatWon,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

const CONDITIONS: ItemCondition[] = ["sealed", "like_new", "lightly_used"];
const SELLER_TRADE_METHODS: TradeMethod[] = ["meetup", "shipping", "any"];
const SELLER_TRADE_LABEL: Record<TradeMethod, string> = {
  meetup: "직거래",
  shipping: "택배",
  any: "둘 다 가능",
};

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

  useDeepHeader({ title: "판매 제안하기" });

  if (!product) {
    return (
      <EmptyState
        title="제품을 찾을 수 없어요"
        action={<Button to="/" variant="secondary">홈으로</Button>}
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
      setPhotoError("이미지 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > 700_000) {
      setPhotoError("V1에서는 700KB 이하 사진을 사용해 주세요.");
      return;
    }
    try {
      setQuickPhotoUrl(await fileToDataUrl(file));
    } catch {
      setPhotoError("사진을 읽지 못했어요.");
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
        setError("물품 보유 정보를 만들지 못했어요.");
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
        setError("판매 제안을 보내지 못했어요.");
        return;
      }
      navigate("/my?tab=selling");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack page-narrow quick-offer-page quick-offer-page--blueprint">
      <section className="deal-product-card quick-offer-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">판매 제안</p>
          <h1 className="page-title">{product.name}</h1>
          {aggregate?.seekerCount ? (
            <p className="quick-offer-signal">
              지금 <strong>{aggregate.seekerCount}명</strong>이 찾고 있어요
            </p>
          ) : null}
        </div>
      </section>

      {targetBuyDemand ? (
        <section className="live-demand-banner">
          <span>선택한 구매수요 · 최대 희망가</span>
          <strong>{formatWon(targetBuyDemand.details.maxPrice)}</strong>
          <button type="button" onClick={() => setPrice(String(targetBuyDemand.details.maxPrice))}>
            이 가격 사용
          </button>
        </section>
      ) : aggregate?.highestIntentPrice ? (
        <section className="live-demand-banner">
          <span>현재 최고 구매 희망가</span>
          <strong>{formatWon(aggregate.highestIntentPrice)}</strong>
          <button
            type="button"
            onClick={() => setPrice(String(aggregate.highestIntentPrice))}
          >
            이 가격 사용
          </button>
        </section>
      ) : null}

      <section className="section-stack quick-offer-form">
        <div>
          <p className="field-inline-label">내 물건 상태</p>
          <ChipGroup>
            {CONDITIONS.map((item) => (
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

        <Field label="희망 판매가" hint="구매자는 가격과 기본 상태를 먼저 확인해요.">
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(price)}
            onChange={(event) => setPrice(digitsOnly(event.target.value))}
            placeholder="예: 2,130,000"
          />
        </Field>

        {showUsageCount ? (
          <Field
            label="대략적인 컷수"
            hint="구매자가 관심을 보이면 정확한 컷수와 상세 증거를 제출해요."
          >
            <TextInput
              inputMode="numeric"
              value={formatDigitsGrouped(usageCount)}
              onChange={(event) =>
                setUsageCount(digitsOnly(event.target.value))
              }
              placeholder="예: 2,400"
            />
          </Field>
        ) : null}

        <div>
          <p className="field-inline-label">가능한 거래 방식</p>
          <ChipGroup>
            {SELLER_TRADE_METHODS.map((item) => (
              <Chip
                key={item}
                selected={tradeMethod === item}
                onClick={() => setTradeMethod(item)}
              >
                {SELLER_TRADE_LABEL[item]}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        <Field label="상태 한 줄">
          <TextInput
            value={conditionNote}
            onChange={(event) => setConditionNote(event.target.value)}
            placeholder="예: 상태 좋음 · 상단 미세스크래치"
          />
        </Field>

        <details className="quick-offer-photo" open={Boolean(quickPhotoUrl)}>
          <summary>
            <span>
              <strong>사진 추가</strong>
              <small>선택 · 지금은 없어도 제안할 수 있어요</small>
            </span>
            <span aria-hidden>⌄</span>
          </summary>
          <div className="quick-offer-photo__body">
            <label className="evidence-upload evidence-upload--quick">
              {quickPhotoUrl ? (
                <img src={quickPhotoUrl} alt="현재 물품" />
              ) : (
                <span>현재 물품 사진을 추가하면 구매자가 제안을 더 쉽게 확인할 수 있어요.</span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void pickPhoto(event.target.files?.[0])}
              />
            </label>
            {photoError ? <p className="form-error">{photoError}</p> : null}
          </div>
        </details>

        <div className="quick-offer-note">
          <strong>지금은 가격과 상태면 충분해요</strong>
          <p>
            구매자가 관심을 보이고 연결된 뒤, 실제 거래를 계속할 때만 촬영 코드와 상세 증거를 제출합니다.
          </p>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        <Button
          fullWidth
          size="lg"
          disabled={!canSubmit || busy}
          onClick={() => void submit()}
        >
          {busy ? "제안 중…" : "제안 보내기"}
        </Button>
      </section>
    </div>
  );
}
