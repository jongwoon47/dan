import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatWon } from "@/lib/format";
import "./pages.css";

export function DemandDetailPage() {
  const { productId = "" } = useParams();
  const { getProduct, getAggregate, myOwnerships, myDemands, currentUser } = useDan();
  const [shareStatus, setShareStatus] = useState("");
  const product = getProduct(productId);
  const aggregate = getAggregate(productId);
  const owned = myOwnerships.find((o) => o.productId === productId);
  const myBuy = myDemands.find(
    (d) =>
      d.type === "BUY" &&
      d.status === "ACTIVE" &&
      d.userId === currentUser?.id &&
      d.details.productId === productId,
  );

  async function shareDemand() {
    if (!product) return;
    const shareData = {
      title: `${product.name} · DAN Live Demand`,
      text: `${aggregate?.seekerCount ?? 0}명이 지금 ${product.name}을 찾고 있어요.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareStatus("공유했어요");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        setShareStatus("링크를 복사했어요");
      } else {
        setShareStatus("주소창의 링크를 복사해 주세요");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("공유하지 못했어요");
    }
  }

  useDeepHeader({
    title: product?.name ?? ko.seekingOnly,
    hide: !product,
    right: product ? (
      <button
        type="button"
        className="deep-header-share"
        onClick={() => void shareDemand()}
        aria-label="Live Demand 공유"
      >
        공유
      </button>
    ) : undefined,
  });

  if (!product || !aggregate) {
    return (
      <EmptyState
        title={ko.missingDemand}
        body={ko.detailMissingBody}
        action={<Button to="/" variant="secondary">Live Demand</Button>}
      />
    );
  }

  return (
    <div className="page-stack page-narrow detail-page detail-page--blueprint">
      <section className="demand-detail-hero">
        <ProductVisual product={product} size="lg" />
        <div className="demand-detail-copy">
          <span className="eyebrow">Live Demand</span>
          <h1>{product.name}</h1>
          <p className="detail-hero__count">
            <strong>{aggregate.seekerCount}명</strong>이 지금 찾고 있어요
          </p>
          <p className="section-desc">
            구매자가 원하는 물건과 가격을 먼저 올려둔 실제 수요예요.
          </p>
        </div>
      </section>

      {shareStatus ? (
        <p className="share-status" role="status">{shareStatus}</p>
      ) : null}

      <section className="demand-detail-summary">
        <div>
          <span>현재 최고 구매 희망가</span>
          <strong>
            {aggregate.highestIntentPrice > 0
              ? formatWon(aggregate.highestIntentPrice)
              : "가격 확인 중"}
          </strong>
        </div>
        <div>
          <span>구매자 희망 거래 방식</span>
          <strong>{aggregate.fulfillmentSummary || "거래방식 확인"}</strong>
        </div>
      </section>

      <section className="seller-action-card">
        <div>
          <span>이 제품을 가지고 있나요?</span>
          <h2>가격과 기본 상태만 적고 바로 제안하세요.</h2>
          <p>구매자가 관심을 보인 뒤에 상세 증거와 거래 조건을 확정합니다.</p>
        </div>
        <Button to={`/demand/${product.id}/offer`} fullWidth size="lg">
          판매 제안하기
        </Button>
        {owned ? <small>등록한 내 물건 정보를 재사용할 수 있어요.</small> : null}
      </section>

      {myBuy ? (
        <section className="detail-section demand-my-request">
          <div>
            <span>내 구매수요</span>
            <strong>최대 {formatWon(myBuy.budget)}</strong>
          </div>
          <Button to={`/demand/item/${myBuy.id}`} fullWidth variant="secondary">
            내 구매수요 관리
          </Button>
        </section>
      ) : (
        <p className="detail-foot">
          같은 제품을 찾고 있나요? <Link to={`/buy/new?q=${encodeURIComponent(product.name)}`}>나도 구매수요 등록</Link>
        </p>
      )}
    </div>
  );
}
