import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import {
  digitsOnly,
  formatDigitsGrouped,
  formatWon,
  parseMoneyInput,
} from "@/lib/format";
import "./pages.css";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

export function SellIntentPage() {
  const { ownershipId = "" } = useParams();
  const navigate = useNavigate();
  const { myOwnerships, getProduct, getAggregate, createSellIntent } = useDan();
  const ownership = myOwnerships.find((o) => o.id === ownershipId);
  const product = ownership ? getProduct(ownership.productId) : undefined;
  const aggregate = ownership ? getAggregate(ownership.productId) : null;
  const suggested = aggregate?.highestIntentPrice ?? 0;

  const [price, setPrice] = useState(suggested ? String(suggested) : "");
  const [usageCount, setUsageCount] = useState("");
  const [conditionNote, setConditionNote] = useState("");
  const [quickPhotoUrl, setQuickPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);

  useDeepHeader({ title: "빠른 판매 제안" });

  if (!ownership || !product) {
    return (
      <EmptyState
        title="등록된 물건이 없어요"
        body="먼저 내 물건을 등록해 주세요."
        action={<Button to="/feed" variant="secondary">구매수요 보기</Button>}
      />
    );
  }

  async function pickPhoto(file?: File) {
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("이미지 파일만 올릴 수 있어요.");
      return;
    }
    if (file.size > 700_000) {
      setPhotoError("700KB 이하 사진을 사용해 주세요.");
      return;
    }
    try {
      setQuickPhotoUrl(await fileToDataUrl(file));
    } catch {
      setPhotoError("사진을 읽지 못했어요.");
    }
  }

  async function submit() {
    if (busy) return;
    const minimumPrice = parseMoneyInput(price);
    if (!Number.isFinite(minimumPrice) || minimumPrice <= 0) return;
    setBusy(true);
    try {
      const created = await createSellIntent({
        ownershipId,
        minimumPrice,
        approxUsageCount: usageCount ? Number(usageCount) : undefined,
        conditionNote: conditionNote.trim() || undefined,
        quickPhotoUrl: quickPhotoUrl || undefined,
      });
      if (created) navigate("/my");
    } finally {
      setBusy(false);
    }
  }

  const typed = parseMoneyInput(price);
  const seekerCount = aggregate?.seekerCount ?? 0;

  return (
    <div className="page-stack page-narrow quick-offer-page">
      <section className="deal-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">판매 제안</p>
          <h1 className="page-title">{product.name}</h1>
          {seekerCount > 0 ? (
            <p className="quick-offer-signal">
              지금 <strong>{seekerCount}명</strong>이 찾고 있어요
            </p>
          ) : null}
        </div>
      </section>

      {suggested > 0 ? (
        <section className="live-demand-banner">
          <span>현재 최고 구매희망가</span>
          <strong>{formatWon(suggested)}</strong>
          <button type="button" onClick={() => setPrice(String(suggested))}>
            이 가격 사용
          </button>
        </section>
      ) : null}

      <section className="section-stack quick-offer-form">
        <Field label="희망 판매가" hint="구매자가 먼저 가격을 확인합니다.">
          <TextInput
            inputMode="numeric"
            value={formatDigitsGrouped(price)}
            onChange={(e) => setPrice(digitsOnly(e.target.value))}
            placeholder="예: 2,130,000"
          />
        </Field>

        {product.category === "camera" ? (
          <Field label="대략적인 컷수" hint="정확하지 않아도 괜찮아요. 거래 전 다시 확인할 수 있어요.">
            <TextInput
              inputMode="numeric"
              value={formatDigitsGrouped(usageCount)}
              onChange={(e) => setUsageCount(digitsOnly(e.target.value))}
              placeholder="예: 2,400"
            />
          </Field>
        ) : null}

        <Field label="상태 한 줄">
          <TextInput
            value={conditionNote}
            onChange={(e) => setConditionNote(e.target.value)}
            placeholder="예: 상태 좋음 · 상단 미세스크래치"
          />
        </Field>

        <div>
          <p className="field-inline-label">현재 사진 1장 <span className="muted">선택</span></p>
          <label className="evidence-upload evidence-upload--quick">
            {quickPhotoUrl ? (
              <img src={quickPhotoUrl} alt="현재 물품" />
            ) : (
              <span>사진을 추가하면 구매자가 더 빠르게 판단할 수 있어요</span>
            )}
            <input type="file" accept="image/*" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
          </label>
          {photoError ? <p className="form-error">{photoError}</p> : null}
        </div>

        <div className="quick-offer-note">
          <strong>지금은 가볍게 제안하세요</strong>
          <p>구매자가 제안을 선택하면 채팅에서 세부 정보를 확인할 수 있어요.</p>
        </div>

        <Button fullWidth size="lg" onClick={() => void submit()} disabled={busy || typed <= 0}>
          {busy ? "제안 중…" : "제안 보내기"}
        </Button>
      </section>
    </div>
  );
}
