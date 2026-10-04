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
import { DEMAND_TYPE_LABEL, isBuyDemand, type Demand, type DemandType } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

type MyTab = "active" | "requests" | "done";

const TYPE_ICON: Record<DemandType, string> = {
  BUY: "🛍️",
  BORROW: "📦",
  TASK: "🧭",
  SERVICE: "🛠️",
};

function normalizeTab(value: string | null): MyTab {
  if (value === "requests") return "requests";
  if (value === "done") return "done";
  return "active";
}

function demandPrice(demand: Demand) {
  return isBuyDemand(demand) ? demand.details.maxPrice : demand.budget;
}

export function MyDanPage() {
  const {
    isLoggedIn,
    login,
    currentUser,
    myDemands,
    mySellIntents,
    myMatches,
    getProduct,
  } = useDan();
  const dataMode = getDataMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = normalizeTab(searchParams.get("tab"));

  const activeDemands = useMemo(
    () =>
      myDemands
        .filter((demand) => {
          const status = effectiveDemandStatus(demand);
          return status === "ACTIVE" || status === "MATCHED";
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [myDemands],
  );

  const activeMatches = useMemo(
    () =>
      myMatches.filter(
        (match) =>
          match.status === "CONNECTED" ||
          match.status === "BUYER_INTERESTED",
      ),
    [myMatches],
  );

  const completedMatches = useMemo(
    () => myMatches.filter((match) => match.status === "COMPLETED"),
    [myMatches],
  );

  const pendingSellIntents = useMemo(
    () =>
      mySellIntents
        .filter((offer) => offer.status === "OPEN")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [mySellIntents],
  );

  const proposalCountByDemand = useMemo(() => {
    const map = new Map<string, number>();
    for (const match of myMatches) {
      if (match.status === "DECLINED" || match.status === "CLOSED") continue;
      map.set(match.demandId, (map.get(match.demandId) ?? 0) + 1);
    }
    return map;
  }, [myMatches]);

  if (!isLoggedIn) {
    return (
      <EmptyState
        title="로그인이 필요해요"
        body="내 요청과 거래를 확인하려면 로그인해 주세요."
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

  const activeCount = activeMatches.length + pendingSellIntents.length;

  return (
    <div className="page-stack my-dan my-dan--blueprint">
      <header className="my-dan__header my-dan__header--v1">
        <div>
          <p className="eyebrow">거래 관리</p>
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
          진행 중 <span>{activeCount}</span>
        </button>
        <button
          type="button"
          className={tab === "requests" ? "is-active" : ""}
          onClick={() => changeTab("requests")}
        >
          내 요청 <span>{activeDemands.length}</span>
        </button>
        <button
          type="button"
          className={tab === "done" ? "is-active" : ""}
          onClick={() => changeTab("done")}
        >
          완료 <span>{completedMatches.length}</span>
        </button>
      </nav>

      {tab === "active" ? (
        <section className="my-demand-panel">
          {activeMatches.length > 0 ? (
            <div className="my-active-trades">
              <div className="my-demand-section-head">
                <div>
                  <h2>진행 중인 거래</h2>
                  <p>다음 행동이 필요한 거래부터 확인하세요.</p>
                </div>
              </div>
              <MatchList matches={activeMatches} emptyWhenZero={false} />
            </div>
          ) : null}

          {pendingSellIntents.length > 0 ? (
            <div className="my-pending-offers">
              <div className="my-demand-section-head">
                <div>
                  <h2>상대 확인 중</h2>
                  <p>내가 보낸 제안을 상대가 확인하고 있어요.</p>
                </div>
              </div>
              <div className="seller-offer-list">
                {pendingSellIntents.map((offer) => {
                  const product = getProduct(offer.productId);
                  return (
                    <Link
                      key={offer.id}
                      to={"/demand/" + offer.productId}
                      className="seller-offer-row"
                    >
                      {product ? <ProductVisual product={product} size="sm" /> : null}
                      <div>
                        <strong>{product?.name ?? "판매 제안"}</strong>
                        <span>{formatWon(offer.minimumPrice)} · 상대 확인 중</span>
                      </div>
                      <span aria-hidden>›</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeCount === 0 ? (
            <EmptyState
              title="진행 중인 거래가 없어요"
              body="내 요청에 제안이 오거나, 내가 보낸 제안이 선택되면 여기에서 이어갈 수 있어요."
              action={<Button to="/feed">요청 탐색</Button>}
            />
          ) : null}
        </section>
      ) : null}

      {tab === "requests" ? (
        <section className="my-demand-panel">
          {activeDemands.length === 0 ? (
            <EmptyState
              title="아직 올린 요청이 없어요"
              body="구매, 빌리기, 심부름, 서비스 중 필요한 것을 요청해보세요."
              action={<Button to="/create">요청 만들기</Button>}
            />
          ) : (
            <div className="my-demand-card-list">
              {activeDemands.map((demand) => {
                const product = isBuyDemand(demand)
                  ? getProduct(demand.details.productId)
                  : undefined;
                const count = proposalCountByDemand.get(demand.id) ?? 0;
                const status = effectiveDemandStatus(demand);
                return (
                  <Link
                    key={demand.id}
                    to={"/demand/item/" + demand.id}
                    className="my-demand-card"
                  >
                    {product ? (
                      <ProductVisual product={product} size="sm" />
                    ) : (
                      <span className="my-demand-card__type-icon" aria-hidden>
                        {TYPE_ICON[demand.type]}
                      </span>
                    )}
                    <div className="my-demand-card__body">
                      <div className="my-demand-card__head">
                        <strong>{demand.title}</strong>
                        <span>{status === "MATCHED" ? "거래 진행" : DEMAND_TYPE_LABEL[demand.type]}</span>
                      </div>
                      <p>{formatWon(demandPrice(demand))}</p>
                      <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
                    </div>
                    <div className="my-demand-card__offer">
                      <strong>{count}</strong>
                      <span>제안</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="my-demand-create-row">
            <Button to="/create" variant="secondary">
              + 새 요청
            </Button>
          </div>
        </section>
      ) : null}

      {tab === "done" ? (
        <section className="my-demand-panel">
          {completedMatches.length > 0 ? (
            <MatchList matches={completedMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title="완료된 거래가 없어요"
              body="완료된 거래는 여기에 기록돼요."
              action={<Button to="/feed" variant="secondary">요청 탐색</Button>}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
