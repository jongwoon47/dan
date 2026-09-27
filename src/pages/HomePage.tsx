import { Link } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDan } from "@/domain/danContext";
import "./pages.css";
import "@/components/feedCards.css";

export function HomePage() {
  const { demandFeed } = useDan();
  const cameraDemand = demandFeed
    .filter(
      (item) =>
        item.kind === "aggregated" &&
        item.product.category === "camera" &&
        item.aggregate.seekerCount > 0,
    )
    .slice(0, 6);

  return (
    <div className="page-stack home-page home-page--v1">
      <section className="dan-v1-hero">
        <div className="dan-v1-hero__eyebrow">DAN · Demand-first marketplace</div>
        <h1>찾아서 사는 게 아니라,<br />사고 싶다고 먼저 말해요.</h1>
        <p>
          원하는 카메라와 가격을 남기면, 그 물건을 가진 사람이
          판매를 제안합니다.
        </p>
        <Button to="/buy/new" fullWidth size="lg">
          구매수요 등록하기
        </Button>
      </section>

      <section className="section-stack">
        <div className="section-head section-head--v1">
          <div>
            <h2 className="section-title section-title--xl">지금 사고 있는 사람들</h2>
            <p className="section-desc">
              살아 있는 구매수요만 보여줘요. 판매자는 이 수요를 보고 직접 제안합니다.
            </p>
          </div>
          <Link to="/feed" className="text-link">전체 보기</Link>
        </div>

        {cameraDemand.length === 0 ? (
          <EmptyState
            title="아직 카메라 구매수요가 없어요"
            body="첫 구매수요를 남기면 여기에 표시돼요."
            action={<Button to="/buy/new">구매수요 등록</Button>}
          />
        ) : (
          <div className="live-demand-list">
            {cameraDemand.map((item) =>
              item.kind === "aggregated" ? (
                <AggregatedDemandCard
                  key={item.id}
                  product={item.product}
                  aggregate={item.aggregate}
                />
              ) : null,
            )}
          </div>
        )}
      </section>

      <section className="seller-entry-banner">
        <div>
          <span>카메라를 가지고 있나요?</span>
          <strong>팔 생각이 없었어도, 지금 누가 얼마에 찾는지 먼저 확인하세요.</strong>
        </div>
        <Button to="/feed" variant="secondary">
          구매수요 보기
        </Button>
      </section>
    </div>
  );
}
