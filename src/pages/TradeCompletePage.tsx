import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { DealSnapshot, PublicProfile } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

function formatTradeDate(iso?: string): string {
  if (!iso) return "완료 시각 확인 중";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function TradeCompletePage() {
  const { matchId = "" } = useParams();
  const {
    myMatches,
    currentUser,
    getProduct,
    getDealSnapshot,
    getPublicProfile,
  } = useDan();
  const match = myMatches.find((row) => row.id === matchId);
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [peer, setPeer] = useState<PublicProfile | null>(null);

  useDeepHeader({ title: "거래 완료" });

  const peerId =
    match && currentUser
      ? currentUser.id === match.buyerId
        ? match.sellerId
        : match.buyerId
      : "";

  useEffect(() => {
    if (!matchId) return;
    void getDealSnapshot(matchId).then(setSnapshot);
  }, [getDealSnapshot, matchId]);

  useEffect(() => {
    if (!peerId) return;
    void getPublicProfile(peerId).then(setPeer);
  }, [getPublicProfile, peerId]);

  if (!match || !product || !currentUser) {
    return (
      <EmptyState
        title="거래 정보를 찾을 수 없어요"
        action={<Button to="/my">내 구매수요</Button>}
      />
    );
  }

  if (match.status !== "COMPLETED") {
    return (
      <EmptyState
        title="아직 거래가 완료되지 않았어요"
        body="양쪽이 물품 인계를 확인하면 완료됩니다."
        action={<Button to={"/deal/" + match.id + "/handoff"}>거래 진행</Button>}
      />
    );
  }

  return (
    <div className="page-stack page-narrow trade-complete-page">
      <section className="trade-complete-hero">
        <span className="trade-complete-check" aria-hidden>✓</span>
        <h1>거래가 완료됐어요</h1>
        <p>양쪽의 인계 확인이 끝났고 거래 결과가 Trust History에 사실 기록으로 남았어요.</p>
      </section>

      <section className="trade-complete-product">
        <ProductVisual product={product} size="sm" />
        <div>
          <strong>{product.name}</strong>
          <span>{snapshot ? formatWon(snapshot.agreedPrice) : "거래 완료"}</span>
        </div>
      </section>

      <section className="trade-complete-receipt" aria-label="완료된 거래 정보">
        <div>
          <span>거래 금액</span>
          <strong>{snapshot ? formatWon(snapshot.agreedPrice) : "확인 중"}</strong>
        </div>
        <div>
          <span>완료일</span>
          <strong>{formatTradeDate(match.completedAt)}</strong>
        </div>
        <div>
          <span>거래 상대</span>
          <strong>{peer?.displayName || "상대 사용자"}</strong>
        </div>
        <div>
          <span>기록 상태</span>
          <strong>Trust History 반영 완료</strong>
        </div>
      </section>

      <Button to={"/profile/" + peerId} fullWidth variant="secondary">
        상대 Trust History 보기
      </Button>
      <Button to={"/profile/" + currentUser.id} fullWidth>
        내 거래 이력 보기
      </Button>
      <Button to="/" fullWidth variant="ghost">
        홈으로
      </Button>
    </div>
  );
}
