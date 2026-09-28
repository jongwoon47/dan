import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductVisual } from "@/components/ProductVisual";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { DealEvidence, DealSnapshot } from "@/domain/types";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { formatWon } from "@/lib/format";
import "./pages.css";

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
  const [error, setError] = useState("");

  useDeepHeader({ title: "거래 조건 확인" });

  useEffect(() => {
    if (!matchId) return;
    void Promise.all([getDealEvidence(matchId), getDealSnapshot(matchId)]).then(
      ([e, d]) => {
        setEvidence(e);
        setSnapshot(d);
      },
    );
  }, [getDealEvidence, getDealSnapshot, matchId]);

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
      },
    };
  }, [match, demand, product, sell, evidence]);

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
        <ProductVisual product={product} size="sm" />
        <div>
          <p className="eyebrow">Deal Snapshot</p>
          <h1 className="page-title">{product.name}</h1>
          <strong className="deal-price">{formatWon(sell.minimumPrice)}</strong>
        </div>
      </section>

      <section className="deal-snapshot-card">
        <div className="snapshot-section">
          <span>제품 정보</span>
          <strong>{product.name}</strong>
        </div>
        <div className="snapshot-section">
          <span>컷수</span>
          <strong>{evidence.usageCount == null ? "미제출" : `${evidence.usageCount.toLocaleString("ko-KR")}컷`}</strong>
        </div>
        <div className="snapshot-section">
          <span>보증</span>
          <strong>{evidence.warrantyUntil || "미제출"}</strong>
        </div>
        <div className="snapshot-section">
          <span>구성품</span>
          <strong>{evidence.components.join(", ") || "없음"}</strong>
        </div>
        <div className="snapshot-section">
          <span>외관</span>
          <strong>{evidence.cosmeticNotes || "미제출"}</strong>
        </div>
        <div className="snapshot-section">
          <span>알려진 기능 이상</span>
          <strong>{evidence.knownIssues || "미제출"}</strong>
        </div>
        <div className="snapshot-section">
          <span>거래 방식</span>
          <strong>{formatFulfillmentSummary(demand.fulfillmentOptions)}</strong>
        </div>
      </section>

      <section className="trust-explainer">
        <strong>이 화면은 거래 당시 조건을 고정합니다</strong>
        <p>양쪽이 같은 내용을 확인하면 Deal Snapshot이 잠기고 이후 수정할 수 없습니다. 변경하려면 기존 거래를 종료하고 새 조건으로 다시 확인해야 합니다.</p>
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
          <Button to={`/deal/${match.id}/handoff`} fullWidth size="lg">
            안전결제 · 직거래 단계
          </Button>
        </>
      ) : (
        <>
          {error ? <p className="form-error">{error}</p> : null}
          <Button fullWidth size="lg" disabled={busy || !payload || myConfirmed} onClick={() => void confirm()}>
            {myConfirmed ? "상대 확인 대기 중" : "이 거래조건을 확인했습니다"}
          </Button>
        </>
      )}

      <Button to={`/match/${match.id}`} variant="secondary" fullWidth>
        채팅으로 돌아가기
      </Button>
    </div>
  );
}
