import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductVisual } from "@/components/ProductVisual";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { DealEvidence, DealSnapshot } from "@/domain/types";
import { formatFulfillmentSummary, primaryPublicPlace } from "@/domain/fulfillment";
import { formatWon } from "@/lib/format";
import "./pages.css";

function handoffValue(snapshot: DealSnapshot | null, key: string): string {
  const handoff = snapshot?.snapshot?.handoff;
  if (!handoff || typeof handoff !== "object") return "";
  const value = (handoff as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function toLocalDateTimeInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DealSnapshotPage() {
  const { matchId = "" } = useParams();
  const {
    myMatches,
    state,
    getDemand,
    getProduct,
    currentUser,
    getDealEvidence,
    getDealSnapshot,
    confirmDealSnapshot,
    busy,
  } = useDan();
  const match = myMatches.find((m) => m.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const sell = match?.sellIntentId
    ? state.sellIntents.find((s) => s.id === match.sellIntentId)
    : undefined;

  const [evidence, setEvidence] = useState<DealEvidence | null>(null);
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [agreedMethod, setAgreedMethod] = useState<"meetup" | "shipping">("meetup");
  const [agreedPlace, setAgreedPlace] = useState("");
  const [agreedAt, setAgreedAt] = useState("");
  const [error, setError] = useState("");

  useDeepHeader({ title: "거래 조건 확인" });

  useEffect(() => {
    if (!matchId) return;
    void Promise.all([getDealEvidence(matchId), getDealSnapshot(matchId)]).then(
      ([e, d]) => {
        setEvidence(e);
        setSnapshot(d);

        const storedMethod = handoffValue(d, "agreedMethod");
        const fallbackMethod =
          demand?.type === "BUY" && demand.details.tradeMethod === "shipping"
            ? "shipping"
            : "meetup";
        setAgreedMethod(
          storedMethod === "shipping" || storedMethod === "meetup"
            ? storedMethod
            : fallbackMethod,
        );

        const fallbackPlace = demand
          ? primaryPublicPlace(demand.fulfillmentOptions)?.publicLabel ?? ""
          : "";
        setAgreedPlace(handoffValue(d, "agreedPlace") || fallbackPlace);
        setAgreedAt(toLocalDateTimeInput(handoffValue(d, "agreedAt")));
      },
    );
  }, [demand, getDealEvidence, getDealSnapshot, matchId]);

  const payload = useMemo(() => {
    if (!match || !demand || !product || !sell || !evidence) return null;
    return {
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
      },
      offer: {
        price: sell.minimumPrice,
        approxUsageCount: sell.approxUsageCount ?? null,
        conditionNote: sell.conditionNote ?? "",
      },
      evidence: {
        serialLast4: evidence.serialLast4 ?? null,
        usageCount: evidence.usageCount ?? null,
        purchaseDate: evidence.purchaseDate ?? null,
        warrantyUntil: evidence.warrantyUntil ?? null,
        components: evidence.components,
        cosmeticNotes: evidence.cosmeticNotes,
        knownIssues: evidence.knownIssues,
        repairHistory: evidence.repairHistory,
        waterDamageStatement: evidence.waterDamageStatement,
      },
      handoff: {
        method: formatFulfillmentSummary(demand.fulfillmentOptions),
        agreedMethod,
        agreedPlace: agreedMethod === "meetup" ? agreedPlace.trim() : "",
        agreedAt:
          agreedMethod === "meetup" && agreedAt
            ? new Date(agreedAt).toISOString()
            : "",
      },
    };
  }, [match, demand, product, sell, evidence, agreedMethod, agreedPlace, agreedAt]);

  if (!match || !demand || !product || !sell || !currentUser) {
    return (
      <EmptyState
        title="거래 정보를 찾을 수 없어요"
        action={<Button to="/my" variant="secondary">My DAN</Button>}
      />
    );
  }

  const isBuyer = currentUser.id === match.buyerId;
  const myConfirmed = isBuyer
    ? Boolean(snapshot?.buyerConfirmedAt)
    : Boolean(snapshot?.sellerConfirmedAt);
  const peerConfirmed = isBuyer
    ? Boolean(snapshot?.sellerConfirmedAt)
    : Boolean(snapshot?.buyerConfirmedAt);
  const demandTradeMethod = demand.type === "BUY" ? demand.details.tradeMethod : "meetup";
  const meetupAllowed = demandTradeMethod !== "shipping";
  const shippingAllowed = demandTradeMethod !== "meetup";
  const handoffReady =
    agreedMethod === "shipping" || Boolean(agreedPlace.trim() && agreedAt);
  const storedMethod = handoffValue(snapshot, "agreedMethod");
  const storedPlace = handoffValue(snapshot, "agreedPlace");
  const storedAt = toLocalDateTimeInput(handoffValue(snapshot, "agreedAt"));
  const termsChanged = Boolean(
    snapshot &&
      (storedMethod !== agreedMethod ||
        (agreedMethod === "meetup" &&
          (storedPlace !== agreedPlace.trim() || storedAt !== agreedAt))),
  );
  const effectiveMyConfirmed = myConfirmed && !termsChanged;

  async function confirm() {
    if (!payload || busy) return;
    const activeSell = sell;
    if (!activeSell) return;
    setError("");
    const result = await confirmDealSnapshot({
      matchId,
      agreedPrice: activeSell.minimumPrice,
      snapshot: payload,
    });
    if (!result) {
      setError("거래 조건을 저장하지 못했어요.");
      return;
    }
    setSnapshot(result);
  }

  if (!evidence) {
    return (
      <EmptyState
        title="판매자 증거가 아직 없어요"
        body={isBuyer ? "판매자가 상태 정보를 제출하면 거래 조건을 확인할 수 있어요." : "먼저 물품 상태와 증거를 제출해 주세요."}
        action={
          isBuyer ? (
            <Button to="/my" variant="secondary">거래 목록</Button>
          ) : (
            <Button to={`/deal/${match.id}/evidence`}>증거 제출</Button>
          )
        }
      />
    );
  }

  return (
    <div className="page-stack page-narrow deal-page">
      <section className="deal-product-card deal-product-card--snapshot">
        <div className="deal-product-card__main">
          <ProductVisual product={product} size="sm" />
          <div>
            <p className="eyebrow">Deal Snapshot</p>
            <h1 className="page-title">{product.name}</h1>
            <strong className="deal-price">{formatWon(sell.minimumPrice)}</strong>
          </div>
          <span className="deal-product-card__heart" aria-hidden>♡</span>
        </div>
        <div className="deal-product-card__stats">
          <div>
            <strong>{evidence.usageCount != null ? evidence.usageCount.toLocaleString("ko-KR") : "—"}</strong>
            <span>{product.category === "camera" ? "컷수" : "사용량"}</span>
          </div>
          <div>
            <strong>{evidence.cosmeticNotes || "미제출"}</strong>
            <span>외관 상태</span>
          </div>
          <div>
            <strong>{evidence.knownIssues || "없음"}</strong>
            <span>기능 이상</span>
          </div>
        </div>
      </section>

      {!snapshot?.lockedAt ? (
        <section className="handoff-plan-card">
          <div className="handoff-plan-card__head">
            <div>
              <span className="eyebrow">인계 약속</span>
              <h2>어떻게 물건을 주고받을까요?</h2>
            </div>
            <small>양쪽이 같은 조건을 확인해야 잠겨요.</small>
          </div>

          <div className="handoff-method-toggle" role="group" aria-label="최종 거래 방식">
            {meetupAllowed ? (
              <button
                type="button"
                className={agreedMethod === "meetup" ? "is-selected" : ""}
                onClick={() => setAgreedMethod("meetup")}
              >
                직거래
              </button>
            ) : null}
            {shippingAllowed ? (
              <button
                type="button"
                className={agreedMethod === "shipping" ? "is-selected" : ""}
                onClick={() => setAgreedMethod("shipping")}
              >
                택배
              </button>
            ) : null}
          </div>

          {agreedMethod === "meetup" ? (
            <div className="handoff-plan-fields">
              <label className="field">
                <span>만남 장소</span>
                <input
                  className="dan-input"
                  value={agreedPlace}
                  maxLength={200}
                  onChange={(event) => setAgreedPlace(event.target.value)}
                  placeholder="예: 강남역 11번 출구"
                />
              </label>
              <label className="field">
                <span>만남 시간</span>
                <input
                  className="dan-input"
                  type="datetime-local"
                  value={agreedAt}
                  onChange={(event) => setAgreedAt(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <p className="section-desc">택배 거래로 확정합니다. 발송과 수령 세부사항은 채팅에서 조율하세요.</p>
          )}
        </section>
      ) : null}

      <section className="deal-snapshot-card deal-snapshot-card--focused">
        <div className="snapshot-card-heading">
          <div>
            <span className="eyebrow">핵심 거래 조건</span>
            <h2>확인해야 할 내용만 먼저 보여드려요.</h2>
          </div>
          <strong>{formatWon(sell.minimumPrice)}</strong>
        </div>

        {evidence.usageCount != null ? (
          <div className="snapshot-section snapshot-section--key">
            <span>{product.category === "camera" ? "컷수" : "사용량 / 횟수"}</span>
            <strong>
              {product.category === "camera"
                ? `${evidence.usageCount.toLocaleString("ko-KR")}컷`
                : evidence.usageCount.toLocaleString("ko-KR")}
            </strong>
          </div>
        ) : null}
        <div className="snapshot-section snapshot-section--key">
          <span>외관</span>
          <strong>{evidence.cosmeticNotes || "미제출"}</strong>
        </div>
        <div className="snapshot-section snapshot-section--key">
          <span>기능 이상</span>
          <strong>{evidence.knownIssues || "미제출"}</strong>
        </div>
        <div className="snapshot-section snapshot-section--key">
          <span>최종 거래 방식</span>
          <strong>{agreedMethod === "meetup" ? "직거래" : "택배"}</strong>
        </div>
        {agreedMethod === "meetup" ? (
          <>
            <div className="snapshot-section snapshot-section--key">
              <span>만남 장소</span>
              <strong>{agreedPlace.trim() || "확인 필요"}</strong>
            </div>
            <div className="snapshot-section snapshot-section--key">
              <span>만남 시간</span>
              <strong>{agreedAt ? new Date(agreedAt).toLocaleString("ko-KR") : "확인 필요"}</strong>
            </div>
          </>
        ) : null}

        <details className="snapshot-details">
          <summary>
            <span>
              <strong>판매자 제출 상세</strong>
              <small>구매·보증·식별번호·구성품·수리 이력</small>
            </span>
            <span className="snapshot-details__chevron" aria-hidden>⌄</span>
          </summary>
          <div className="snapshot-details__body">
            <div className="snapshot-section">
              <span>제품 정보</span>
              <strong>{product.name}</strong>
            </div>
            <div className="snapshot-section">
              <span>구매일</span>
              <strong>{evidence.purchaseDate || "미제출"}</strong>
            </div>
            <div className="snapshot-section">
              <span>보증기간</span>
              <strong>{evidence.warrantyUntil || "미제출"}</strong>
            </div>
            <div className="snapshot-section">
              <span>식별번호 끝자리</span>
              <strong>{evidence.serialLast4 ? `••••${evidence.serialLast4}` : "미제출"}</strong>
            </div>
            <div className="snapshot-section">
              <span>구성품</span>
              <strong>{evidence.components.join(", ") || "없음"}</strong>
            </div>
            <div className="snapshot-section">
              <span>수리 이력</span>
              <strong>{evidence.repairHistory || "없음"}</strong>
            </div>
            <div className="snapshot-section">
              <span>침수 / 물손상 이력</span>
              <strong>{evidence.waterDamageStatement || "미제출"}</strong>
            </div>
          </div>
        </details>
      </section>

      <section className="snapshot-lock-notice">
        <strong>위 조건으로 거래를 진행합니다.</strong>
        <p>양쪽이 확인하면 Deal Snapshot이 잠기고 이후에는 수정할 수 없어요. 실제 물건과 다른 내용이 있다면 확인 전에 판매자와 다시 조율하세요.</p>
      </section>

      <section className="deal-confirm-state">
        <div className={myConfirmed ? "confirm-state is-done" : "confirm-state"}>
          <span>나</span><strong>{myConfirmed ? "확인 완료" : "확인 필요"}</strong>
        </div>
        <div className={peerConfirmed ? "confirm-state is-done" : "confirm-state"}>
          <span>상대</span><strong>{peerConfirmed ? "확인 완료" : "대기 중"}</strong>
        </div>
      </section>

      {snapshot?.lockedAt ? (
        <>
          <section className="safe-payment-placeholder">
            <span className="safe-payment-placeholder__icon">✓</span>
            <div>
              <strong>거래 조건이 확정됐어요</strong>
              <p>
                이제 안전결제 상태를 확인한 뒤 현장에서 같은 Deal Snapshot을
                다시 대조합니다.
              </p>
            </div>
          </section>
          <Button to={`/deal/${match.id}/payment`} fullWidth size="lg">
            안전결제로 이동
          </Button>
        </>
      ) : (
        <>
          {error ? <p className="form-error">{error}</p> : null}
          <Button fullWidth size="lg" disabled={busy || !payload || !handoffReady || effectiveMyConfirmed} onClick={() => void confirm()}>
            {effectiveMyConfirmed ? "상대 확인 대기 중" : termsChanged ? "변경한 조건 다시 확인" : "이 거래조건을 확인했습니다"}
          </Button>
        </>
      )}

      <Button to={`/match/${match.id}`} variant="secondary" fullWidth>
        채팅으로 돌아가기
      </Button>
    </div>
  );
}
