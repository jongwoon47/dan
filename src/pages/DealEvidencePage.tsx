import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, TextInput } from "@/components/ui/Input";
import { ProductVisual } from "@/components/ProductVisual";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { DealEvidence } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

const COMPONENT_OPTIONS = ["풀박스", "정품 배터리", "스트랩", "충전기", "보증서"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

export function DealEvidencePage() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();
  const {
    myMatches,
    state,
    getDemand,
    getProduct,
    currentUser,
    getDealEvidence,
    upsertDealEvidence,
    connectAsSeller,
    busy,
  } = useDan();
  const match = myMatches.find((m) => m.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const sell = match?.sellIntentId
    ? state.sellIntents.find((s) => s.id === match.sellIntentId)
    : undefined;
  const isSeller = Boolean(match && currentUser?.id === match.sellerId);

  const [existing, setExisting] = useState<DealEvidence | null>(null);
  const [usageCount, setUsageCount] = useState("");
  const [serialLast4, setSerialLast4] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyUntil, setWarrantyUntil] = useState("");
  const [components, setComponents] = useState<string[]>([]);
  const [cosmeticNotes, setCosmeticNotes] = useState("");
  const [knownIssues, setKnownIssues] = useState("");
  const [repairHistory, setRepairHistory] = useState("");
  const [waterDamageStatement, setWaterDamageStatement] = useState("");
  const [possessionPhotoUrl, setPossessionPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useDeepHeader({ title: "판매자 증거 제출" });

  useEffect(() => {
    if (!matchId) return;
    void getDealEvidence(matchId).then((row) => {
      if (!row) return;
      setExisting(row);
      setUsageCount(row.usageCount == null ? "" : String(row.usageCount));
      setSerialLast4(row.serialLast4 ?? "");
      setPurchaseDate(row.purchaseDate ?? "");
      setWarrantyUntil(row.warrantyUntil ?? "");
      setComponents(row.components);
      setCosmeticNotes(row.cosmeticNotes);
      setKnownIssues(row.knownIssues);
      setRepairHistory(row.repairHistory);
      setWaterDamageStatement(row.waterDamageStatement);
      setPossessionPhotoUrl(row.possessionPhotoUrl ?? "");
    });
  }, [getDealEvidence, matchId]);

  const canSubmit = useMemo(
    () =>
      isSeller &&
      serialLast4.trim().length >= 2 &&
      cosmeticNotes.trim().length > 0 &&
      knownIssues.trim().length > 0,
    [isSeller, serialLast4, cosmeticNotes, knownIssues],
  );

  if (!match || !demand || !product || !sell || !currentUser) {
    return (
      <EmptyState
        title="거래 정보를 찾을 수 없어요"
        body="거래 목록에서 다시 들어와 주세요."
        action={<Button to="/my" variant="secondary">My DAN</Button>}
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
      setPhotoError("V1에서는 700KB 이하 사진만 사용할 수 있어요.");
      return;
    }
    try {
      setPossessionPhotoUrl(await fileToDataUrl(file));
    } catch {
      setPhotoError("사진을 읽지 못했어요.");
    }
  }

  function toggleComponent(label: string) {
    setComponents((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  }

  async function submit() {
    if (!canSubmit || busy) return;
    setSubmitError("");
    const row = await upsertDealEvidence({
      matchId,
      possessionPhotoUrl: possessionPhotoUrl || undefined,
      serialLast4: serialLast4.trim(),
      usageCount: usageCount ? Number(usageCount) : undefined,
      purchaseDate: purchaseDate || undefined,
      warrantyUntil: warrantyUntil || undefined,
      components,
      cosmeticNotes,
      knownIssues,
      repairHistory,
      waterDamageStatement,
      evidenceMeta: { source: "seller_submitted", productCategory: product.category },
    });
    if (!row) {
      setSubmitError("증거를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    if (match.status === "BUYER_INTERESTED") {
      await connectAsSeller(match.id);
    }
    navigate(`/deal/${match.id}/snapshot`);
  }

  return (
    <div className="page-stack page-narrow deal-page">
      <section className="deal-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">Quick Offer</p>
          <h1 className="page-title">{product.name}</h1>
          <strong className="deal-price">{formatWon(sell.minimumPrice)}</strong>
        </div>
      </section>

      <section className="trust-explainer">
        <strong>판매자가 제출한 정보예요</strong>
        <p>DAN이 제품 상태나 정품 여부를 보증하지 않습니다. 거래 당시 무엇을 주장했고 어떤 증거를 냈는지 기록합니다.</p>
      </section>

      {!isSeller && existing ? (
        <section className="deal-evidence-summary">
          <EvidenceSummary evidence={existing} />
          <Button to={`/deal/${match.id}/snapshot`} fullWidth size="lg">
            거래 조건 확인
          </Button>
        </section>
      ) : null}

      {isSeller ? (
        <section className="section-stack deal-form">
          <div>
            <p className="field-inline-label">현재 보유 사진</p>
            <label className="evidence-upload">
              {possessionPhotoUrl ? (
                <img src={possessionPhotoUrl} alt="현재 보유 물품" />
              ) : (
                <span>카메라와 오늘의 물품을 함께 찍어주세요</span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
            </label>
            {photoError ? <p className="form-error">{photoError}</p> : null}
          </div>

          <div className="deal-grid-2">
            <Field label="컷수">
              <TextInput
                inputMode="numeric"
                value={usageCount}
                onChange={(e) => setUsageCount(e.target.value.replace(/\D/g, ""))}
                placeholder="예: 2417"
              />
            </Field>
            <Field label="시리얼 끝자리">
              <TextInput
                value={serialLast4}
                onChange={(e) => setSerialLast4(e.target.value.slice(0, 8))}
                placeholder="예: 3812"
              />
            </Field>
          </div>

          <div className="deal-grid-2">
            <Field label="구매일">
              <input className="dan-input" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </Field>
            <Field label="보증 종료">
              <input className="dan-input" type="date" value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)} />
            </Field>
          </div>

          <div>
            <p className="field-inline-label">구성품</p>
            <div className="evidence-chip-row">
              {COMPONENT_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={components.includes(item) ? "evidence-chip is-selected" : "evidence-chip"}
                  onClick={() => toggleComponent(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <Field label="외관 상태">
            <textarea className="dan-textarea dan-input" value={cosmeticNotes} onChange={(e) => setCosmeticNotes(e.target.value)} placeholder="예: 상단 미세스크래치 1곳" />
          </Field>
          <Field label="알려진 기능 이상">
            <textarea className="dan-textarea dan-input" value={knownIssues} onChange={(e) => setKnownIssues(e.target.value)} placeholder="없다면 ‘없음’이라고 적어주세요" />
          </Field>
          <Field label="수리 이력">
            <textarea className="dan-textarea dan-input" value={repairHistory} onChange={(e) => setRepairHistory(e.target.value)} placeholder="없음 / 수리 내용" />
          </Field>
          <Field label="침수 이력">
            <TextInput value={waterDamageStatement} onChange={(e) => setWaterDamageStatement(e.target.value)} placeholder="없음 / 있음 / 모름" />
          </Field>

          {submitError ? <p className="form-error">{submitError}</p> : null}
          <Button fullWidth size="lg" disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? "저장 중…" : "증거 제출하고 거래 조건 확인"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function EvidenceSummary({ evidence }: { evidence: DealEvidence }) {
  return (
    <dl className="deal-facts">
      <div><dt>컷수</dt><dd>{evidence.usageCount == null ? "미제출" : `${evidence.usageCount.toLocaleString("ko-KR")}컷`}</dd></div>
      <div><dt>시리얼</dt><dd>{evidence.serialLast4 ? `••••${evidence.serialLast4}` : "미제출"}</dd></div>
      <div><dt>구성품</dt><dd>{evidence.components.join(", ") || "없음"}</dd></div>
      <div><dt>외관</dt><dd>{evidence.cosmeticNotes || "미제출"}</dd></div>
      <div><dt>기능 이상</dt><dd>{evidence.knownIssues || "미제출"}</dd></div>
    </dl>
  );
}
