import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MatchList } from "@/components/MatchCard";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { effectiveDemandStatus } from "@/domain/demandLifecycle";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { DEMAND_TYPE_LABEL, isBuyDemand } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

type MyTab = "active" | "requests" | "completed";

function normalizeTab(value: string | null): MyTab {
  if (value === "requests" || value === "completed") return value;
  return "active";
}

function requestStatusLabel(status: string): string {
  if (status === "MATCHED") return "거래 진행";
  if (status === "EXPIRED") return "기간 만료";
  if (status === "CLOSED") return "종료";
  return "요청 중";
}

export function MyDanPage() {
  const {
    isLoggedIn,
    login,
    currentUser,
    myDemands,
    myMatches,
    getProduct,
  } = useDan();
  const dataMode = getDataMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = normalizeTab(searchParams.get("tab"));

  const activeMatches = useMemo(
    () =>
      myMatches.filter(
        (match) =>
          match.status !== "COMPLETED" &&
          match.status !== "CLOSED" &&
          match.status !== "DECLINED",
      ),
    [myMatches],
  );

  const completedMatches = useMemo(
    () => myMatches.filter((match) => match.status === "COMPLETED"),
    [myMatches],
  );

  const requestRows = useMemo(
    () =>
      [...myDemands].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [myDemands],
  );

  if (!isLoggedIn) {
    return (
      <EmptyState
        title="로그인이 필요해요"
        body="진행 중인 거래와 내가 올린 요청을 확인하려면 로그인해 주세요."
        action={
          dataMode === "supabase" ? (
            <Button to="/login">로그인</Button>
          ) : (
            <Button onClick={() => login()}>로그인</Button>
          )
        }
      />
    );
  }

  function changeTab(next: MyTab) {
    setSearchParams(next === "active" ? {} : { tab: next });
  }

  return (
    <div className="page-stack my-dan my-dan--v3">
      <header className="my-dan__header my-dan__header--v1">
        <div>
          <p className="eyebrow">DAN</p>
          <h1 className="page-title">내 거래</h1>
        </div>
        <Link to={"/profile/" + currentUser?.id} className="my-dan__name">
          프로필 <span aria-hidden>›</span>
        </Link>
      </header>

      <nav className="my-demand-tabs" aria-label="내 거래 메뉴">
        <button
          type="button"
          className={tab === "active" ? "is-active" : ""}
          onClick={() => changeTab("active")}
        >
          진행 중
          <span>{activeMatches.length}</span>
        </button>
        <button
          type="button"
          className={tab === "requests" ? "is-active" : ""}
          onClick={() => changeTab("requests")}
        >
          내 요청
          <span>{requestRows.length}</span>
        </button>
        <button
          type="button"
          className={tab === "completed" ? "is-active" : ""}
          onClick={() => changeTab("completed")}
        >
          완료
          <span>{completedMatches.length}</span>
        </button>
      </nav>

      {tab === "active" ? (
        <section className="my-demand-panel">
          <div className="my-demand-section-head">
            <div>
              <h2>지금 이어가야 할 거래</h2>
              <p>새 제안부터 채팅, 조건 확인, 결제·인계까지 한곳에서 이어갈 수 있어요.</p>
            </div>
          </div>
          {activeMatches.length > 0 ? (
            <MatchList matches={activeMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title="진행 중인 거래가 없어요"
              body="요청을 올리거나 탐색에서 다른 사람의 요청에 제안해보세요."
              action={<Button to="/feed" variant="secondary">요청 둘러보기</Button>}
            />
          )}
        </section>
      ) : null}

      {tab === "requests" ? (
        <section className="my-demand-panel">
          {requestRows.length > 0 ? (
            <div className="my-demand-card-list">
              {requestRows.map((demand) => {
                const status = effectiveDemandStatus(demand);
                const product = isBuyDemand(demand)
                  ? getProduct(demand.details.productId)
                  : undefined;
                return (
                  <Link
                    key={demand.id}
                    to={"/demand/item/" + demand.id}
                    className="my-demand-card my-demand-card--all-types"
                  >
                    {product ? (
                      <ProductVisual product={product} size="sm" />
                    ) : (
                      <span className="request-type-avatar" aria-hidden>
                        {DEMAND_TYPE_LABEL[demand.type].slice(0, 1)}
                      </span>
                    )}
                    <div className="my-demand-card__body">
                      <div className="my-demand-card__head">
                        <strong>{demand.title}</strong>
                        <span>{requestStatusLabel(status)}</span>
                      </div>
                      <p>
                        {DEMAND_TYPE_LABEL[demand.type]} · {formatWon(demand.budget)}
                      </p>
                      <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
                    </div>
                    <span className="my-demand-card__chevron" aria-hidden>›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="아직 올린 요청이 없어요"
              body="구매, 빌리기, 심부름, 서비스 중 필요한 요청을 올려보세요."
              action={<Button to="/create">요청 올리기</Button>}
            />
          )}

          <Button to="/create" variant="secondary" fullWidth>
            새 요청 올리기
          </Button>
        </section>
      ) : null}

      {tab === "completed" ? (
        <section className="my-demand-panel">
          <div className="my-demand-section-head">
            <div>
              <h2>완료된 거래</h2>
              <p>확정된 거래 결과와 상대 정보를 다시 확인할 수 있어요.</p>
            </div>
          </div>
          {completedMatches.length > 0 ? (
            <MatchList matches={completedMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title="완료된 거래가 아직 없어요"
              body="거래가 끝나면 여기에 기록됩니다."
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
