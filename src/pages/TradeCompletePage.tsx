import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { DealSnapshot, PublicProfile } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

export function TradeCompletePage() {
  const { matchId = "" } = useParams();
  const locale = useDanLocale();
  const {
    myMatches,
    currentUser,
    getProduct,
    getDemand,
    getDealSnapshot,
    getPublicProfile,
  } = useDan();
  const match = myMatches.find((row) => row.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [peer, setPeer] = useState<PublicProfile | null>(null);

  useDeepHeader({ title: "거래 완료" });

  useEffect(() => {
    if (!matchId || !match || !currentUser) return;
    const peerId =
      currentUser.id === match.buyerId ? match.sellerId : match.buyerId;
    void Promise.all([
      getDealSnapshot(matchId),
      getPublicProfile(peerId),
    ]).then(([dealSnapshot, publicProfile]) => {
      setSnapshot(dealSnapshot);
      setPeer(publicProfile);
    });
  }, [currentUser, getDealSnapshot, getPublicProfile, match, matchId]);

  if (!match || !product || !currentUser) {
    return <EmptyState title="거래 정보를 찾을 수 없어요" action={<Button to="/my">내 거래</Button>} />;
  }

  if (match.status !== "COMPLETED") {
    return (
      <EmptyState
        title="아직 거래가 완료되지 않았어요"
        body="양쪽이 직거래 인계를 확인하면 완료됩니다."
        action={<Button to={"/deal/" + match.id + "/handoff"}>거래 진행</Button>}
      />
    );
  }

  const peerId = currentUser.id === match.buyerId ? match.sellerId : match.buyerId;

  return (
    <div className="page-stack page-narrow trade-complete-page">
      <section className="trade-complete-hero">
        <span className="trade-complete-check" aria-hidden>✓</span>
        <h1>거래가 완료됐어요</h1>
        <p>양쪽의 인계 확인이 끝났어요.</p>
      </section>

      <section className="trade-complete-product">
        <ProductVisual product={product} size="sm" />
        <div>
          <strong>{product.name}</strong>
          <span>
            {snapshot
              ? formatStoredMoney(
                  snapshot.agreedPrice,
                  snapshot.currencyCode ?? demand?.currencyCode ?? "KRW",
                  locale,
                )
              : "거래 완료"}
          </span>
        </div>
      </section>

      <section className="deal-snapshot-card trade-receipt">
        <div className="snapshot-section">
          <span>거래 상태</span>
          <strong>완료</strong>
        </div>
        <div className="snapshot-section">
          <span>최종 거래 금액</span>
          <strong>
            {snapshot
              ? formatStoredMoney(
                  snapshot.agreedPrice,
                  snapshot.currencyCode ?? demand?.currencyCode ?? "KRW",
                  locale,
                )
              : "확인 중"}
          </strong>
        </div>
        <div className="snapshot-section">
          <span>거래 상대</span>
          <strong>{peer?.displayName || "상대"}</strong>
        </div>
        <div className="snapshot-section">
          <span>완료 시각</span>
          <strong>
            {match.completedAt
              ? new Date(match.completedAt).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "완료"}
          </strong>
        </div>
      </section>

      <Button to="/my?tab=completed" fullWidth>
        거래 내역 보기
      </Button>
      <Button to={"/profile/" + peerId} fullWidth variant="secondary">
        상대 프로필 보기
      </Button>
      <Button to="/" fullWidth variant="ghost">
        홈으로
      </Button>
    </div>
  );
}
