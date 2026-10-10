import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, TextInput } from "@/components/ui/Input";
import { ProductVisual } from "@/components/ProductVisual";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { fillCopyTemplate } from "@/copy/dealChain";
import { localizeStoredComponent } from "@/copy/evidenceComponents";
import { useDanCopy, type LocalizedCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import type { DealEvidence, DealEvidenceChallenge, Product } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

type ComponentOption = { store: string; label: string };

function componentOptionsFor(product: Product, copy: LocalizedCopy): ComponentOption[] {
  if (
    product.category === "fashion" ||
    product.category === "shoes" ||
    product.category === "watches_accessories"
  ) {
    return [
      { store: "제품", label: copy.evidenceCompProduct },
      { store: "박스/더스트백", label: copy.evidenceCompBoxDust },
      { store: "택", label: copy.evidenceCompTag },
      { store: "보증서/영수증", label: copy.evidenceCompWarranty },
      { store: "추가 구성품", label: copy.evidenceCompExtra },
    ];
  }
  if (product.category === "furniture") {
    return [
      { store: "제품/본체", label: copy.evidenceCompBody },
      { store: "조립 부품", label: copy.evidenceCompParts },
      { store: "설명서", label: copy.evidenceCompManual },
      { store: "보증서/영수증", label: copy.evidenceCompWarranty },
      { store: "추가 부품", label: copy.evidenceCompExtraParts },
    ];
  }
  if (product.category === "books_media") {
    return [
      { store: "본품", label: copy.evidenceCompMain },
      { store: "케이스", label: copy.evidenceCompCase },
      { store: "부록", label: copy.evidenceCompBonus },
      { store: "포토카드/특전", label: copy.evidenceCompPhotocard },
      { store: "영수증", label: copy.evidenceCompReceipt },
    ];
  }
  if (product.category === "hobby_collectible") {
    return [
      { store: "본품", label: copy.evidenceCompMain },
      { store: "원박스", label: copy.evidenceCompOrigBox },
      { store: "설명서", label: copy.evidenceCompManual },
      { store: "한정 구성품", label: copy.evidenceCompLimited },
      { store: "영수증", label: copy.evidenceCompReceipt },
    ];
  }
  return [
    { store: "제품/본체", label: copy.evidenceCompBody },
    { store: "박스", label: copy.evidenceCompBox },
    { store: "충전기/어댑터", label: copy.evidenceCompCharger },
    { store: "케이블", label: copy.evidenceCompCable },
    { store: "보증서/영수증", label: copy.evidenceCompWarranty },
  ];
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
  const locale = useDanLocale();
  const copy = useDanCopy();
  const numberLocale = locale === "ja" ? "ja-JP" : "ko-KR";
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

  useDeepHeader({
    title: isSeller ? copy.evidenceTitleSeller : copy.evidenceTitleBuyer,
  });

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
    setChallenge(null);

    const issue = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        if (cancelled) return;
        const row = await issueDealEvidenceChallenge(matchId);
        if (cancelled) return;
        if (row) {
          setChallenge(row);
          setChallengeError("");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
      if (!cancelled) setChallengeError(copy.evidenceChallengeFail);
    };

    void issue();
    return () => {
      cancelled = true;
    };
    // Intentionally omit issueDealEvidenceChallenge identity — the store
    // recreates context methods on every refresh and would cancel in-flight
    // challenge RPCs before the code lands in page state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable issue by matchId/status
  }, [copy.evidenceChallengeFail, isSeller, match?.status, matchId]);

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
        title={copy.evidenceConnectFirstTitle}
        body={copy.evidenceConnectFirstBody}
        action={<Button to="/my">{copy.evidenceBackToOffers}</Button>}
      />
    );
  }

  const showUsageCount = product?.category === "camera";
  const componentOptions = product ? componentOptionsFor(product, copy) : [];

  if (!currentUser) {
    return (
      <EmptyState
        title={copy.dealMissingTitle}
        body={copy.evidenceMissingBody}
        action={
          <Button to="/my" variant="secondary">
            My DAN
          </Button>
        }
      />
    );
  }

  if (!match || !demand || !product || !sell) {
    // Direct /deal/:id/evidence navigations can race store hydration after
    // connect — send the seller back through match chat to rehydrate.
    return (
      <EmptyState
        title={copy.dealMissingTitle}
        body={copy.evidenceMissingBody}
        action={
          <Button to={matchId ? `/match/${matchId}` : "/my"} variant="secondary">
            {matchId ? copy.dealBackToChat : "My DAN"}
          </Button>
        }
      />
    );
  }

  async function pickPhoto(file?: File) {
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError(copy.dealImageFileOnly);
      return;
    }
    if (file.size > 700_000) {
      setPhotoError(copy.dealPhotoTooLarge);
      return;
    }
    try {
      setPossessionPhotoUrl(await fileToDataUrl(file));
    } catch {
      setPhotoError(copy.dealPhotoReadFailed);
    }
  }

  function toggleComponent(store: string) {
    setComponents((prev) =>
      prev.includes(store) ? prev.filter((x) => x !== store) : [...prev, store],
    );
  }

  async function submit() {
    if (!canSubmit || busy) return;
    const activeMatch = match;
    const activeProduct = product;
    if (!activeMatch || !activeProduct) return;
    setSubmitError("");
    if (!challenge) return;
    try {
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
        evidenceMeta: {
          source: "seller_submitted",
          productCategory: activeProduct.category,
        },
      });
      if (!row) {
        setSubmitError(copy.evidenceSaveFail);
        return;
      }
      navigate(`/deal/${activeMatch.id}/snapshot`);
    } catch {
      setSubmitError(copy.evidenceSaveFail);
    }
  }

  const money = formatStoredMoney(
    sell.minimumPrice,
    demand.currencyCode ?? "KRW",
    locale,
  );

  return (
    <div className="page-stack page-narrow deal-page">
      <section className="deal-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">{copy.evidenceEyebrow}</p>
          <h1 className="page-title">{product.name}</h1>
          <strong className="deal-price">{money}</strong>
        </div>
      </section>

      <section className="trust-explainer">
        <strong>{copy.evidenceTrustTitle}</strong>
        <p>{copy.evidenceTrustBody}</p>
      </section>

      {!isSeller && existing ? (
        <section className="deal-evidence-summary">
          <EvidenceSummary
            evidence={existing}
            product={product}
            copy={copy}
            numberLocale={numberLocale}
          />
          <Button to={`/deal/${match.id}/snapshot`} fullWidth size="lg">
            {copy.evidenceReviewSnapshot}
          </Button>
        </section>
      ) : null}

      {isSeller && sellerVerificationLoaded && !sellerVerifiedForDeal ? (
        <section className="verification-gate">
          <strong>{copy.evidenceVerifyTitle}</strong>
          <p>{copy.evidenceVerifyBody}</p>
        </section>
      ) : null}

      {isSeller ? (
        <section className="section-stack deal-form">
          <div className="evidence-challenge-block">
            <div className="evidence-challenge-copy">
              <p className="field-inline-label">{copy.evidencePhotoRequired}</p>
              <p>{copy.evidenceChallengeBody}</p>
            </div>
            {challenge ? (
              <div className="evidence-challenge-code">
                <span>{copy.evidenceChallengeCode}</span>
                <strong>{challenge.challengeCode}</strong>
                <small>{copy.evidenceChallengeTtl}</small>
              </div>
            ) : (
              <div className="evidence-challenge-code evidence-challenge-code--loading">
                <span>{challengeError || copy.evidenceChallengeLoading}</span>
                {challengeError ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setChallengeError("");
                      void issueDealEvidenceChallenge(matchId).then((row) => {
                        if (!row) {
                          setChallengeError(copy.evidenceChallengeFail);
                          return;
                        }
                        setChallenge(row);
                      });
                    }}
                  >
                    {copy.evidenceNewCode}
                  </Button>
                ) : null}
              </div>
            )}
            <label className="evidence-upload">
              {possessionPhotoUrl ? (
                <img src={possessionPhotoUrl} alt={copy.evidencePhotoAlt} />
              ) : (
                <span>
                  {challenge
                    ? fillCopyTemplate(copy.evidencePhotoWithCode, {
                        code: challenge.challengeCode,
                      })
                    : copy.evidencePhotoWaitCode}
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
            <div>
              <strong>{copy.evidenceSectionProduct}</strong>
              <small>{copy.evidenceSectionProductHint}</small>
            </div>
          </div>

          <div className="deal-grid-2">
            {showUsageCount ? (
              <Field label={copy.dealShutterCount}>
                <TextInput
                  inputMode="numeric"
                  value={usageCount}
                  onChange={(e) => setUsageCount(e.target.value.replace(/\D/g, ""))}
                  placeholder={copy.evidenceUsagePh}
                />
              </Field>
            ) : null}
            <Field label={copy.evidenceSerialLabel}>
              <TextInput
                value={serialLast4}
                onChange={(e) => setSerialLast4(e.target.value.slice(0, 8))}
                placeholder={copy.evidenceSerialPh}
              />
            </Field>
          </div>

          <div className="deal-grid-2">
            <Field label={copy.evidencePurchaseDate}>
              <input
                className="dan-input"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </Field>
            <Field label={copy.evidenceWarrantyEnd}>
              <input
                className="dan-input"
                type="date"
                value={warrantyUntil}
                onChange={(e) => setWarrantyUntil(e.target.value)}
              />
            </Field>
          </div>

          <div className="evidence-form-divider">
            <span>3</span>
            <div>
              <strong>{copy.evidenceSectionCondition}</strong>
              <small>{copy.evidenceSectionConditionHint}</small>
            </div>
          </div>

          <div>
            <p className="field-inline-label">{copy.dealComponents}</p>
            <div className="evidence-chip-row">
              {componentOptions.map((item) => (
                <button
                  key={item.store}
                  type="button"
                  className={
                    components.includes(item.store) ? "evidence-chip is-selected" : "evidence-chip"
                  }
                  onClick={() => toggleComponent(item.store)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <Field label={copy.evidenceCosmetic}>
            <textarea
              className="dan-textarea dan-input"
              value={cosmeticNotes}
              onChange={(e) => setCosmeticNotes(e.target.value)}
              placeholder={copy.evidenceCosmeticPh}
            />
          </Field>
          <Field label={copy.evidenceKnownIssuesLabel}>
            <textarea
              className="dan-textarea dan-input"
              value={knownIssues}
              onChange={(e) => setKnownIssues(e.target.value)}
              placeholder={copy.evidenceKnownIssuesPh}
            />
          </Field>
          <Field label={copy.evidenceRepair}>
            <textarea
              className="dan-textarea dan-input"
              value={repairHistory}
              onChange={(e) => setRepairHistory(e.target.value)}
              placeholder={copy.evidenceRepairPh}
            />
          </Field>
          <Field label={copy.evidenceWater}>
            <TextInput
              value={waterDamageStatement}
              onChange={(e) => setWaterDamageStatement(e.target.value)}
              placeholder={copy.evidenceWaterPh}
            />
          </Field>

          {submitError ? <p className="form-error">{submitError}</p> : null}
          <Button fullWidth size="lg" disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? copy.saving : copy.evidenceSave}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function EvidenceSummary({
  evidence,
  product,
  copy,
  numberLocale,
}: {
  evidence: DealEvidence;
  product: Product;
  copy: LocalizedCopy;
  numberLocale: string;
}) {
  const usageValue =
    evidence.usageCount == null
      ? null
      : product.category === "camera"
        ? fillCopyTemplate(copy.dealShutterCountValue, {
            n: evidence.usageCount.toLocaleString(numberLocale),
          })
        : evidence.usageCount.toLocaleString(numberLocale);

  return (
    <div className="deal-evidence-review">
      {evidence.possessionPhotoUrl ? (
        <img
          className="deal-evidence-review__photo"
          src={evidence.possessionPhotoUrl}
          alt={copy.evidenceSellerPhotoAlt}
        />
      ) : null}
      <dl className="deal-facts">
        {usageValue ? (
          <div>
            <dt>
              {product.category === "camera" ? copy.dealShutterCount : copy.dealUsageCount}
            </dt>
            <dd>{usageValue}</dd>
          </div>
        ) : null}
        <div>
          <dt>{copy.evidenceIdentLabel}</dt>
          <dd>
            {evidence.serialLast4 ? `••••${evidence.serialLast4}` : copy.dealNotSubmitted}
          </dd>
        </div>
        <div>
          <dt>{copy.dealComponents}</dt>
          <dd>
            {evidence.components.length
              ? evidence.components.map((c) => localizeStoredComponent(c, copy)).join(", ")
              : copy.dealNone}
          </dd>
        </div>
        <div>
          <dt>{copy.dealAppearance}</dt>
          <dd>{evidence.cosmeticNotes || copy.dealNotSubmitted}</dd>
        </div>
        <div>
          <dt>{copy.evidenceKnownShort}</dt>
          <dd>{evidence.knownIssues || copy.dealNotSubmitted}</dd>
        </div>
      </dl>
    </div>
  );
}
