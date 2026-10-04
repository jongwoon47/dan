import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { TransactionStageBar } from "@/components/TransactionStageBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, TextInput } from "@/components/ui/Input";
import { ProductVisual } from "@/components/ProductVisual";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { DealEvidence, DealEvidenceChallenge, Product } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

function componentOptionsFor(product: Product): string[] {
  if (product.category === "fashion" || product.category === "shoes" || product.category === "watches_accessories") {
    return ["제품", "박스/더스트백", "택", "보증서/영수증", "추가 구성품"];
  }
  if (product.category === "furniture") {
    return ["제품/본체", "조립 부품", "설명서", "보증서/영수증", "추가 부품"];
  }
  if (product.category === "books_media") {
    return ["본품", "케이스", "부록", "포토카드/특전", "영수증"];
  }
  if (product.category === "hobby_collectible") {
    return ["본품", "원박스", "설명서", "한정 구성품", "영수증"];
  }
  return ["제품/본체", "박스", "충전기/어댑터", "케이블", "보증서/영수증"];
}

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
    issueDealEvidenceChallenge,
    getMyVerification,
    getDealEvidence,
    upsertDealEvidence,
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
  const [challenge, setChallenge] = useState<DealEvidenceChallenge | null>(null);
  const [challengeError, setChallengeError] = useState("");
  const [sellerVerificationLoaded, setSellerVerificationLoaded] = useState(false);
  const [sellerVerifiedForDeal, setSellerVerifiedForDeal] = useState(false);
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

  useDeepHeader({ title: isSeller ? "상품 정보 등록" : "상품 정보 확인" });

  useEffect(() => {
    if (!isSeller) {
      setSellerVerificationLoaded(false);
      setSellerVerifiedForDeal(false);
      return;
    }
    let cancelled = false;
    void getMyVerification().then((status) => {
      if (cancelled) return;
      setSellerVerifiedForDeal(
        status.phoneVerified &&
          status.identityVerified &&
          status.payoutVerified &&
          Boolean(status.sellerType),
      );
      setSellerVerificationLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [getMyVerification, isSeller]);

  useEffect(() => {
    if (!matchId || !isSeller || match?.status !== "CONNECTED") return;
    let cancelled = false;
    setChallengeError("");
    void issueDealEvidenceChallenge(matchId).then((row) => {
      if (cancelled) return;
      if (!row) {
        setChallengeError("촬영 코드를 발급하지 못했어요.");
        return;
      }
      setChallenge(row);
    });
    return () => {
      cancelled = true;
    };
  }, [issueDealEvidenceChallenge, isSeller, match?.status, matchId]);

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
      sellerVerifiedForDeal &&
      Boolean(challenge) &&
      Boolean(possessionPhotoUrl) &&
      (serialLast4.trim().length === 0 || serialLast4.trim().length >= 2) &&
      cosmeticNotes.trim().length > 0 &&
      knownIssues.trim().length > 0,
    [
      isSeller,
      sellerVerifiedForDeal,
      challenge,
      possessionPhotoUrl,
      serialLast4,
      cosmeticNotes,
      knownIssues,
    ],
  );

  if (isSeller && match?.status === "BUYER_INTERESTED") {
    return (
      <EmptyState
        title="먼저 구매자와 연결해 주세요"
        body="관심이 확인됐다면 먼저 연결해 대화하세요. 실제 거래를 계속할 때 이 단계에서 증거를 제출합니다."
        action={<Button to="/my?tab=selling">판매 제안으로 돌아가기</Button>}
      />
    );
  }

  const showUsageCount = product?.category === "camera";
  const componentOptions = product ? componentOptionsFor(product) : [];

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
      setPhotoError("700KB 이하 사진만 사용할 수 있어요.");
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
    const activeMatch = match;
    const activeProduct = product;
    if (!activeMatch || !activeProduct) return;
    setSubmitError("");
    if (!challenge) return;
    const row = await upsertDealEvidence({
      matchId,
      challengeCode: challenge.challengeCode,
      possessionPhotoUrl: possessionPhotoUrl || undefined,
      serialLast4: serialLast4.trim() || undefined,
      usageCount:
        activeProduct.category === "camera" && usageCount
          ? Number(usageCount)
          : undefined,
      purchaseDate: purchaseDate || undefined,
      warrantyUntil: warrantyUntil || undefined,
      components,
      cosmeticNotes,
      knownIssues,
      repairHistory,
      waterDamageStatement,
      evidenceMeta: { source: "seller_submitted", productCategory: activeProduct.category },
    });
    if (!row) {
      setSubmitError("증거를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    navigate(`/deal/${activeMatch.id}/snapshot`);
  }

  return (
    <div className="page-stack page-narrow deal-page">
      <TransactionStageBar stage={1} />
      <section className="deal-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">상품 정보</p>
          <h1 className="page-title">{product.name}</h1>
          <strong className="deal-price">{formatWon(sell.minimumPrice)}</strong>
        </div>
      </section>

      <section className="trust-explainer">
        <strong>판매자가 등록한 상품 정보예요</strong>
        <p>판매자가 직접 등록한 정보예요. 실제 물건과 같은지 거래 전에 확인하세요.</p>
      </section>

      {!isSeller && existing ? (
        <section className="deal-evidence-summary">
          <EvidenceSummary evidence={existing} product={product} />
          <Button to={`/deal/${match.id}/snapshot`} fullWidth size="lg">
            거래 조건 확인
          </Button>
        </section>
      ) : null}

      {isSeller && sellerVerificationLoaded && !sellerVerifiedForDeal ? (
        <section className="verification-gate">
          <strong>거래 전에 상품 정보를 확인해 주세요</strong>
          <p>
            제안은 간단히 보낼 수 있지만 거래를 계속하려면
            휴대폰·본인·정산계좌 검증이 모두 완료되어야 합니다.
          </p>
        </section>
      ) : null}

      {isSeller ? (
        <section className="section-stack deal-form">
          <div className="evidence-challenge-block">
            <div className="evidence-challenge-copy">
              <p className="field-inline-label">현재 보유 사진 · 필수</p>
              <p>
                아래 코드를 종이나 다른 화면에 띄워 실제 물품과 함께 촬영해 주세요.
                DAN이 진품이나 상태를 보증하는 것은 아니지만, 오래된 도용 사진을 쓰기 어렵게 합니다.
              </p>
            </div>
            {challenge ? (
              <div className="evidence-challenge-code">
                <span>촬영 코드</span>
                <strong>{challenge.challengeCode}</strong>
                <small>15분 동안 유효</small>
              </div>
            ) : (
              <div className="evidence-challenge-code evidence-challenge-code--loading">
                <span>{challengeError || "촬영 코드 발급 중…"}</span>
                {challengeError ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setChallengeError("");
                      void issueDealEvidenceChallenge(matchId).then((row) => {
                        if (!row) {
                          setChallengeError("촬영 코드를 발급하지 못했어요.");
                          return;
                        }
                        setChallenge(row);
                      });
                    }}
                  >
                    새 코드 받기
                  </Button>
                ) : null}
              </div>
            )}
            <label className="evidence-upload">
              {possessionPhotoUrl ? (
                <img src={possessionPhotoUrl} alt="현재 보유 물품" />
              ) : (
                <span>
                  {challenge
                    ? `물품과 촬영 코드 ${challenge.challengeCode}가 함께 보이게 찍어주세요`
                    : "촬영 코드가 발급되면 사진을 추가할 수 있어요"}
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!challenge}
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
            </label>
            {photoError ? <p className="form-error">{photoError}</p> : null}
          </div>

          <div className="evidence-form-divider">
            <span>2</span>
            <div><strong>제품 정보</strong><small>사용량·식별번호·구매 및 보증 정보가 있다면 함께 남겨요.</small></div>
          </div>

          <div className="deal-grid-2">
            {showUsageCount ? (
              <Field label="컷수">
                <TextInput
                  inputMode="numeric"
                  value={usageCount}
                  onChange={(e) => setUsageCount(e.target.value.replace(/\D/g, ""))}
                  placeholder="예: 2417"
                />
              </Field>
            ) : null}
            <Field label="시리얼 / 식별번호 끝자리 (선택)">
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

          <div className="evidence-form-divider">
            <span>3</span>
            <div><strong>구성품 · 상태 · 추가 정보</strong><small>거래 조건 확인에 함께 표시돼요.</small></div>
          </div>

          <div>
            <p className="field-inline-label">구성품</p>
            <div className="evidence-chip-row">
              {componentOptions.map((item) => (
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
          <Field label="침수 / 물손상 이력 (해당 시)">
            <TextInput value={waterDamageStatement} onChange={(e) => setWaterDamageStatement(e.target.value)} placeholder="없음 / 있음 / 모름" />
          </Field>

          {submitError ? <p className="form-error">{submitError}</p> : null}
          <Button fullWidth size="lg" disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? "저장 중…" : "상품 정보 저장"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function EvidenceSummary({
  evidence,
  product,
}: {
  evidence: DealEvidence;
  product: Product;
}) {
  const usageValue =
    evidence.usageCount == null
      ? null
      : product.category === "camera"
        ? `${evidence.usageCount.toLocaleString("ko-KR")}컷`
        : evidence.usageCount.toLocaleString("ko-KR");

  return (
    <div className="deal-evidence-review">
      {evidence.possessionPhotoUrl ? (
        <img
          className="deal-evidence-review__photo"
          src={evidence.possessionPhotoUrl}
          alt="판매자가 제출한 현재 보유 물품"
        />
      ) : null}
      <dl className="deal-facts">
        {usageValue ? (
          <div>
            <dt>{product.category === "camera" ? "컷수" : "사용량 / 횟수"}</dt>
            <dd>{usageValue}</dd>
          </div>
        ) : null}
        <div><dt>식별번호</dt><dd>{evidence.serialLast4 ? `••••${evidence.serialLast4}` : "미제출"}</dd></div>
        <div><dt>구성품</dt><dd>{evidence.components.join(", ") || "없음"}</dd></div>
        <div><dt>외관</dt><dd>{evidence.cosmeticNotes || "미제출"}</dd></div>
        <div><dt>알려진 이상</dt><dd>{evidence.knownIssues || "미제출"}</dd></div>
      </dl>
    </div>
  );
}
