import { Link, useParams } from "react-router-dom";
import { PriceDistribution } from "@/components/PriceDistribution";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatRelativeCount, formatWon, formatWonShort } from "@/lib/format";
import "./pages.css";

export function DemandDetailPage() {
  const { productId = "" } = useParams();
  const { getProduct, getAggregate, myOwnerships, myDemands, currentUser } = useDan();
  const product = getProduct(productId);
  const aggregate = getAggregate(productId);
  const owned = myOwnerships.find((o) => o.productId === productId);
  const myBuy = myDemands.find((d) => d.type === "BUY" && d.status === "ACTIVE" && d.userId === currentUser?.id && d.details.productId === productId);

  useDeepHeader({ title: product?.name ?? ko.seekingOnly, hide: !product });

  if (!product || !aggregate) {
    return <EmptyState title={ko.missingDemand} body={ko.detailMissingBody} action={<Button to="/feed" variant="secondary">{ko.navFeed}</Button>} />;
  }

  const showTrend = aggregate.recent7dDelta !== 0;
  const showHighest = aggregate.highestIntentPrice > 0;
  const showAvg = aggregate.avgPrice > 0;

  return (
    <div className="page-stack page-narrow detail-page detail-page--blueprint">
      <section className="demand-detail-hero">
        <ProductVisual product={product} size="lg" />
        <div className="demand-detail-copy">
          <span className="eyebrow">Live Demand</span>
          <h1>{product.name}</h1>
          <p className="detail-hero__count"><strong>{aggregate.seekerCount}명</strong>이 지금 찾고 있어요</p>
          <p className="section-desc">필요한 사람이 먼저 남긴 실제 구매 요청이에요.</p>
        </div>
      </section>

      {showHighest || showAvg || showTrend ? (
        <div className="kpi-strip kpi-strip--compact demand-kpi-strip">
          {showHighest ? <div className="kpi-strip__item"><span>{ko.highestHopeShort}</span><strong>{formatWonShort(aggregate.highestIntentPrice)}</strong></div> : null}
          {showAvg ? <div className="kpi-strip__item"><span>{ko.avgHope}</span><strong>{formatWonShort(aggregate.avgPrice)}</strong></div> : null}
          {showTrend ? <div className="kpi-strip__item"><span>{ko.thisWeek}</span><strong>{formatRelativeCount(aggregate.recent7dDelta)}</strong></div> : null}
        </div>
      ) : null}

      <section className="demand-detail-fact"><span>거래 방식</span><strong>{aggregate.fulfillmentSummary || "서울 · 직거래"}</strong></section>

      <section className="seller-action-card">
        <div>
          <span>이 제품을 가지고 있나요?</span>
          <h2>가격과 기본 상태만 적고 바로 제안하세요.</h2>
          <p>구매자가 관심을 보인 뒤 상세 증거와 거래 조건을 확정합니다.</p>
        </div>
        <Button to={`/demand/${product.id}/offer`} fullWidth size="lg">판매 제안하기</Button>
        {owned ? <small>등록한 내 물건 정보를 재사용할 수 있어요.</small> : null}
      </section>

      <section className="detail-section demand-price-section">
        <div className="section-head">
          <h2 className="section-title">{ko.priceDist}</h2>
          <p className="section-desc">현재 살아 있는 구매수요의 희망가 분포예요.</p>
        </div>
        <PriceDistribution buckets={aggregate.priceBuckets} seekerCount={aggregate.seekerCount} />
      </section>

      {myBuy ? (
        <section className="detail-section">
          <h2 className="section-title">{ko.myBuyManage}</h2>
          <p className="section-desc">{ko.maxPrice} {formatWon(myBuy.budget)}</p>
          <Button to={`/demand/item/${myBuy.id}`} fullWidth variant="secondary">{ko.editDemand} / {ko.closeDemand}</Button>
        </section>
      ) : (
        <p className="detail-foot">같은 제품을 찾고 있나요? <Link to="/buy/new">나도 구매수요 등록</Link></p>
      )}
    </div>
  );
}
