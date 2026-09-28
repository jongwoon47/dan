import { Link } from "react-router-dom";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDan } from "@/domain/danContext";
import { DAN_V1_CAMERA_NAMES, DAN_V1_CAMERA_NAME_SET } from "@/domain/danV1";
import "./pages.css";
import "@/components/feedCards.css";

export function HomePage() {
  const { demandFeed } = useDan();
  const cameraDemand = demandFeed
    .filter(
      (item) =>
        item.kind === "aggregated" &&
        DAN_V1_CAMERA_NAME_SET.has(item.product.name) &&
        item.aggregate.seekerCount > 0,
    )
    .sort((a, b) => {
      if (a.kind !== "aggregated" || b.kind !== "aggregated") return 0;
      return (
        DAN_V1_CAMERA_NAMES.indexOf(
          a.product.name as (typeof DAN_V1_CAMERA_NAMES)[number],
        ) -
        DAN_V1_CAMERA_NAMES.indexOf(
          b.product.name as (typeof DAN_V1_CAMERA_NAMES)[number],
        )
      );
    })
    .slice(0, 5);

  const totalDemand = cameraDemand.reduce(
    (sum, item) =>
      sum + (item.kind === "aggregated" ? item.aggregate.seekerCount : 0),
    0,
  );

  return (
    <div className="page-stack home-page home-page--v1">
      <section className="home-demand-header">
        <div className="home-demand-heading">
          <h1>지금 사고 있는 사람들</h1>
          <p>
            아직 판매글이 없어도 괜찮아요.
            <br />
            이 카메라를 가진 사람의 제안을 기다리고 있어요.
          </p>
        </div>

        <div className="home-demand-tabs" role="tablist" aria-label="구매수요 보기">
          <Link to="/" className="home-demand-tab is-active" aria-current="page">
            지금 사고 있는 사람들
          </Link>
          <Link to="/my" className="home-demand-tab">
            내 구매수요
          </Link>
        </div>

        <div className="home-demand-filters" aria-label="카메라 모델 바로가기">
          <Link to="/" className="demand-filter is-active">
            전체 {totalDemand}
          </Link>
          {cameraDemand.map((item) =>
            item.kind === "aggregated" ? (
              <Link key={item.id} to={`/demand/${item.product.id}`} className="demand-filter">
                {item.product.model || item.product.name} {item.aggregate.seekerCount}
              </Link>
            ) : null,
          )}
        </div>
      </section>

      <section className="home-live-section">
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
                <AggregatedDemandCard key={item.id} product={item.product} aggregate={item.aggregate} />
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
        <Button to="/feed" variant="secondary">구매수요 보기</Button>
      </section>
    </div>
  );
}
