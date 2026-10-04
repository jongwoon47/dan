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

export function MyDanPage() {
  const {
    isLoggedIn,
    login,
    currentUser,
    myDemands,
    myMatches,
    mySellIntents,
    getProduct,
  } = useDan();
  const dataMode = getDataMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = normalizeTab(searchParams.get("tab"));
  const demandFilter = searchParams.get("demand");

  const openRequests = useMemo(
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
          match.status !== "COMPLETED" &&
          match.status !== "CLOSED" &&
          match.status !== "DECLINED" &&
          match.status !== "POTENTIAL",
      ),
    [myMatches],
  );

  const pendingOffers = useMemo(
    () =>
      myMatches.filter(
        (match) =>
          match.buyerId === currentUser?.id &&
          match.status === "POTENTIAL" &&
          Boolean(match.sellIntentId),
      ),
    [currentUser?.id, myMatches],
  );

  const visiblePendingOffers = useMemo(
    () =>
      demandFilter
        ? pendingOffers.filter((match) => match.demandId === demandFilter)
        : pendingOffers,
    [demandFilter, pendingOffers],
  );

  const openSentOffers = useMemo(
    () =>
      [...mySellIntents]
        .filter((offer) => offer.status === "OPEN" || offer.status === "MATCHED")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [mySellIntents],
  );

  const completedMatches = useMemo(
    () =>
      [...myMatches]
        .filter((match) => match.status === "COMPLETED")
        .sort((a, b) =>
          (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt),
        ),
    [myMatches],
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
    <div className="page-stack my-dan my-dan--app-v2">
      <header className="my-dan__header my-dan__header--v1">
        <div>
          <h1 className="page-title">내 거래</h1>
          <p className="section-desc">요청부터 완료까지 한곳에서 확인하세요.</p>
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
          진행 중 <span>{activeMatches.length + pendingOffers.length + openSentOffers.length}</span>
        </button>
        <button
          type="button"
          className={tab === "requests" ? "is-active" : ""}
          onClick={() => changeTab("requests")}
        >
          내 요청 <span>{openRequests.length}</span>
        </button>
        <button
          type="button"
          className={tab === "completed" ? "is-active" : ""}
          onClick={() => changeTab("completed")}
        >
          완료 <span>{completedMatches.length}</span>
        </button>
      </nav>

      {tab === "active" ? (
        <section className="my-demand-panel my-active-stack">
          {visiblePendingOffers.length > 0 ? (
            <div className="my-active-section">
              <div className="my-demand-section-head">
                <div>
                  <h2>받은 제안</h2>
                  <p>가격과 조건을 비교하고 거래할 제안을 선택하세요.</p>
                </div>
                {demandFilter ? (
                  <button
                    type="button"
                    className="my-demand-filter-clear"
                    onClick={() => setSearchParams({})}
                  >
                    전체 보기
                  </button>
                ) : null}
              </div>
              <MatchList matches={visiblePendingOffers} emptyWhenZero={false} />
            </div>
          ) : null}

          {activeMatches.length > 0 ? (
            <div className="my-active-section">
              <div className="my-demand-section-head">
                <div>
                  <h2>진행 중인 거래</h2>
                  <p>지금 해야 할 다음 행동을 확인하세요.</p>
                </div>
              </div>
              <MatchList matches={activeMatches} emptyWhenZero={false} />
            </div>
          ) : null}

          {openSentOffers.length > 0 ? (
            <div className="my-active-section">
              <div className="my-demand-section-head">
                <div>
                  <h2>내가 보낸 제안</h2>
                  <p>상대가 선택하면 채팅에서 거래를 이어갈 수 있어요.</p>
                </div>
              </div>
              <div className="seller-offer-list">
                {openSentOffers.map((offer) => {
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
                        <span>
                          {formatWon(offer.minimumPrice)} · {offer.status === "MATCHED" ? "거래 진행" : "상대 확인 대기"}
                        </span>
                      </div>
                      <span aria-hidden>›</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          {visiblePendingOffers.length === 0 &&
          activeMatches.length === 0 &&
          openSentOffers.length === 0 ? (
            <EmptyState
              title="진행 중인 거래가 없어요"
              body="요청을 올리거나 탐색에서 내가 도울 수 있는 요청을 찾아보세요."
              action={<Button to="/feed" variant="secondary">요청 탐색</Button>}
            />
          ) : null}
        </section>
      ) : null}

      {tab === "requests" ? (
        <section className="my-demand-panel">
          {openRequests.length > 0 ? (
            <div className="my-demand-card-list">
              {openRequests.map((demand) => {
                const product = isBuyDemand(demand)
                  ? getProduct(demand.details.productId)
                  : undefined;
                const title = product?.name ?? demand.title;
                const amount = isBuyDemand(demand)
                  ? demand.details.maxPrice
                  : demand.budget;
                return (
                  <Link
                    key={demand.id}
                    to={"/demand/item/" + demand.id}
                    className="my-demand-card my-request-row"
                  >
                    {product ? <ProductVisual product={product} size="sm" /> : (
                      <span className="request-type-mark" aria-hidden>
                        {DEMAND_TYPE_LABEL[demand.type].slice(0, 1)}
                      </span>
                    )}
                    <div className="my-demand-card__body">
                      <div className="my-demand-card__head">
                        <strong>{title}</strong>
                        <span>{DEMAND_TYPE_LABEL[demand.type]}</span>
                      </div>
                      <p>{formatWon(amount)}</p>
                      <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
                    </div>
                    <span className="transaction-chevron" aria-hidden>›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="진행 중인 요청이 없어요"
              body="사고, 빌리고, 부탁하거나 필요한 서비스를 요청해보세요."
            />
          )}
          <Button to="/create" fullWidth size="lg">
            새 요청 만들기
          </Button>
        </section>
      ) : null}

      {tab === "completed" ? (
        <section className="my-demand-panel">
          {completedMatches.length > 0 ? (
            <MatchList matches={completedMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title="완료된 거래가 아직 없어요"
              body="거래가 끝나면 이곳에 기록이 쌓여요."
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
