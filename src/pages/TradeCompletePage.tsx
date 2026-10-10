import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import { isBuyDemand, type DealSnapshot, type PublicProfile } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

export function TradeCompletePage() {
  const { matchId = "" } = useParams();
  const locale = useDanLocale();
  const copy = useDanCopy();
  const ja = locale === "ja";
  const {
    myMatches,
    state,
    currentUser,
    getProduct,
    getDemand,
    getDealSnapshot,
    getPublicProfile,
    refreshData,
  } = useDan();
  const match = myMatches.find((row) => row.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const sell = match?.sellIntentId
    ? state.sellIntents.find((row) => row.id === match.sellIntentId)
    : undefined;
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [peer, setPeer] = useState<PublicProfile | null>(null);

  useDeepHeader({ title: copy.matchStatusCompleted });

  useEffect(() => {
    if (!matchId || !match || !currentUser) return;
    const peerId =
      currentUser.id === match.buyerId ? match.sellerId : match.buyerId;
    let cancelled = false;

    const load = async () => {
      await refreshData().catch(() => undefined);
      if (cancelled) return;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const [dealSnapshot, publicProfile] = await Promise.all([
          getDealSnapshot(matchId),
          getPublicProfile(peerId),
        ]);
        if (cancelled) return;
        if (publicProfile) setPeer(publicProfile);
        if (dealSnapshot) {
          setSnapshot(dealSnapshot);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    currentUser,
    getDealSnapshot,
    getPublicProfile,
    match,
    matchId,
    refreshData,
  ]);

  if (!match || !product || !currentUser) {
    return (
      <EmptyState
        title={ja ? "取引情報が見つかりません" : "거래 정보를 찾을 수 없어요"}
        action={<Button to="/my">{ja ? "自分の取引" : "내 거래"}</Button>}
      />
    );
  }

  if (match.status !== "COMPLETED") {
    return (
      <EmptyState
        title={ja ? "まだ取引が完了していません" : "아직 거래가 완료되지 않았어요"}
        body={
          ja
            ? "双方が受け渡しを確認すると完了します。"
            : "양쪽이 직거래 인계를 확인하면 완료됩니다."
        }
        action={<Button to={"/deal/" + match.id + "/handoff"}>{copy.tradeInProgress}</Button>}
      />
    );
  }

  const peerId = currentUser.id === match.buyerId ? match.sellerId : match.buyerId;
  const currency = snapshot?.currencyCode ?? demand?.currencyCode ?? "KRW";
  const finalPrice =
    snapshot?.agreedPrice ??
    sell?.minimumPrice ??
    (demand && isBuyDemand(demand) ? demand.details.maxPrice : demand?.budget);
  const moneyLabel =
    typeof finalPrice === "number"
      ? formatStoredMoney(finalPrice, currency, locale)
      : null;

  return (
    <div className="page-stack page-narrow trade-complete-page">
      <section className="trade-complete-hero">
        <span className="trade-complete-check" aria-hidden>✓</span>
        <h1>{copy.tradeDoneTitle}</h1>
        <p>
          {ja
            ? "双方の受け渡し確認が終わりました。"
            : "양쪽의 인계 확인이 끝났어요."}
        </p>
      </section>

      <section className="trade-complete-product">
        <ProductVisual product={product} size="sm" />
        <div>
          <strong>{product.name}</strong>
          <span>{moneyLabel ?? copy.matchStatusCompleted}</span>
        </div>
      </section>

      <section className="deal-snapshot-card trade-receipt">
        <div className="snapshot-section">
          <span>{ja ? "取引状態" : "거래 상태"}</span>
          <strong>{copy.matchStatusCompleted}</strong>
        </div>
        <div className="snapshot-section">
          <span>{ja ? "最終取引金額" : "최종 거래 금액"}</span>
          <strong>
            {moneyLabel ?? (ja ? "確認中" : "확인 중")}
          </strong>
        </div>
        <div className="snapshot-section">
          <span>{ja ? "取引相手" : "거래 상대"}</span>
          <strong>{peer?.displayName || (ja ? "相手" : "상대")}</strong>
        </div>
        <div className="snapshot-section">
          <span>{ja ? "完了時刻" : "완료 시각"}</span>
          <strong>
            {match.completedAt
              ? new Date(match.completedAt).toLocaleString(
                  ja ? "ja-JP" : "ko-KR",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )
              : copy.matchStatusCompleted}
          </strong>
        </div>
      </section>

      <Button to="/my?tab=completed" fullWidth>
        {ja ? "取引履歴を見る" : "거래 내역 보기"}
      </Button>
      <Button to={"/profile/" + peerId} fullWidth variant="secondary">
        {ja ? "相手のプロフィールを見る" : "상대 프로필 보기"}
      </Button>
      <Button to="/" fullWidth variant="ghost">
        {ja ? "ホームへ" : "홈으로"}
      </Button>
    </div>
  );
}
