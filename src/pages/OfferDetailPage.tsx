import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { CONDITION_LABEL, type PublicProfile } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

export function OfferDetailPage() {
  const { matchId = "" } = useParams();
  const {
    myMatches,
    state,
    currentUser,
    getProduct,
    getDemand,
    getPublicProfile,
    expressBuyerInterest,
  } = useDan();
  const [sellerProfile, setSellerProfile] = useState<PublicProfile | null>(null);
  const [busy, setBusy] = useState(false);

  const match = myMatches.find((row) => row.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const sell = match?.sellIntentId
    ? state.sellIntents.find((row) => row.id === match.sellIntentId)
    : undefined;
  const ownership = sell
    ? state.ownerships.find((row) => row.id === sell.ownershipId)
    : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const isBuyer = Boolean(match && currentUser?.id === match.buyerId);

  useDeepHeader({ title: "제안 상세" });

  useEffect(() => {
    if (!match?.sellerId) return;
    let cancelled = false;
    void getPublicProfile(match.sellerId).then((profile) => {
      if (!cancelled) setSellerProfile(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [getPublicProfile, match?.sellerId]);

  if (!match || !demand || !sell || !ownership || !product || !currentUser || !isBuyer) {
    return (
      <EmptyState
        title="제안을 찾을 수 없어요"
        body="받은 제안 목록에서 다시 확인해 주세요."
        action={<Button to="/my?tab=offers" variant="secondary">받은 제안</Button>}
      />
    );
  }

  async function interest() {
    if (busy) return;
    setBusy(true);
    try {
      await expressBuyerInterest(match.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack page-narrow offer-detail-page">
      <section className="offer-detail-product">
        <ProductVisual product={product} size="lg" />
        <div>
          <p className="eyebrow">Quick Offer</p>
          <h1 className="page-title">{product.name}</h1>
          <strong className="offer-detail-price">{formatWon(sell.minimumPrice)}</strong>
        </div>
      </section>

      <section className="offer-detail-facts">
        <div><span>컷수</span><strong>{sell.approxUsageCount == null ? "미입력" : "약 " + sell.approxUsageCount.toLocaleString("ko-KR") + "컷"}</strong></div>
        <div><span>상태</span><strong>{CONDITION_LABEL[ownership.condition]}</strong></div>
        <div><span>상태 메모</span><strong>{sell.conditionNote || "특이사항 없음"}</strong></div>
        <div><span>거래 방식</span><strong>{formatFulfillmentSummary(demand.fulfillmentOptions)}</strong></div>
      </section>

      <section className="offer-seller-card">
        <div className="offer-seller-card__head">
          <div>
            <span>판매자</span>
            <strong>{sellerProfile?.displayName || "판매자"}</strong>
          </div>
          {sellerProfile?.identityVerified ? <span className="trust-verified-badge">본인인증 완료</span> : null}
        </div>
        <div className="offer-seller-card__facts">
          <div><strong>{sellerProfile?.completedDemandCount ?? 0}</strong><span>거래 완료</span></div>
          <div><strong>{sellerProfile?.sellerFaultCancellationCount ?? 0}</strong><span>판매자 귀책 취소</span></div>
          <div><strong>{sellerProfile?.unresolvedDisputeCount ?? 0}</strong><span>미해결 분쟁</span></div>
        </div>
        <Button to={"/profile/" + match.sellerId} variant="ghost" fullWidth>
          Trust History 자세히 보기
        </Button>
      </section>

      {match.status === "POTENTIAL" ? (
        <Button fullWidth size="lg" disabled={busy} onClick={() => void interest()}>
          {busy ? "처리 중…" : "관심있어요"}
        </Button>
      ) : match.status === "BUYER_INTERESTED" ? (
        <section className="offer-next-state">
          <strong>판매자에게 관심을 보냈어요</strong>
          <p>판매자가 실제 물건의 증거를 제출하면 다음 단계로 이동할 수 있어요.</p>
          <Button to="/my?tab=offers" variant="secondary" fullWidth>받은 제안으로 돌아가기</Button>
        </section>
      ) : match.status === "CONNECTED" ? (
        <Button to={"/deal/" + match.id + "/evidence"} fullWidth size="lg">
          판매자 증거 확인
        </Button>
      ) : match.status === "COMPLETED" ? (
        <Button to={"/deal/" + match.id + "/complete"} fullWidth variant="secondary">
          완료된 거래 보기
        </Button>
      ) : (
        <Button to="/my?tab=offers" fullWidth variant="secondary">받은 제안</Button>
      )}
    </div>
  );
}
