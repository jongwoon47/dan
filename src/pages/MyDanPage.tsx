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

type MyTab = "demands" | "offers" | "selling";

const TYPE_ICON: Record<DemandType, string> = {
  BUY: "🛍️",
  BORROW: "📦",
  TASK: "🧭",
  SERVICE: "🛠️",
};

function normalizeTab(value: string | null): MyTab {
  if (value === "offers" || value === "selling") return value;
  return "demands";
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
  const demandFilter = searchParams.get("demand");

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

  const receivedOffers = useMemo(
    () =>
      myMatches.filter(
        (match) =>
          match.buyerId === currentUser?.id &&
          Boolean(match.sellIntentId) &&
          match.status !== "DECLINED" &&
          match.status !== "CLOSED",
      ),
    [currentUser?.id, myMatches],
  );

  const visibleReceivedOffers = useMemo(
    () =>
      demandFilter
        ? receivedOffers.filter((match) => match.demandId === demandFilter)
        : receivedOffers,
    [demandFilter, receivedOffers],
  );

  const sellerMatches = useMemo(
    () =>
      myMatches.filter(
        (match) =>
          match.sellerId === currentUser?.id &&
          Boolean(match.sellIntentId) &&
          match.status !== "POTENTIAL" &&
          match.status !== "DECLINED" &&
          match.status !== "CLOSED",
      ),
    [currentUser?.id, myMatches],
  );

  const proposalCountByDemand = useMemo(() => {
    const map = new Map<string, number>();
    for (const match of myMatches) {
      if (
        match.status === "DECLINED" ||
        match.status === "CLOSED"
      ) continue;
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
    setSearchParams(next === "demands" ? {} : { tab: next });
  }

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
          className={tab === "demands" ? "is-active" : ""}
          onClick={() => changeTab("demands")}
        >
          내 요청 <span>{activeDemands.length}</span>
        </button>
        <button
          type="button"
          className={tab === "offers" ? "is-active" : ""}
          onClick={() => changeTab("offers")}
        >
          받은 제안 <span>{receivedOffers.length}</span>
        </button>
        <button
          type="button"
          className={tab === "selling" ? "is-active" : ""}
          onClick={() => changeTab("selling")}
        >
          보낸 제안 <span>{mySellIntents.length}</span>
        </button>
      </nav>

      {tab === "demands" ? (
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

      {tab === "offers" ? (
        <section className="my-demand-panel">
          <div className="my-demand-section-head">
            <div>
              <h2>받은 제안</h2>
              <p>가격, 조건, 거래 이력을 비교하고 거래할 사람을 선택하세요.</p>
            </div>
            {demandFilter ? (
              <button
                type="button"
                className="my-demand-filter-clear"
                onClick={() => setSearchParams({ tab: "offers" })}
              >
                전체 보기
              </button>
            ) : null}
          </div>
          {visibleReceivedOffers.length > 0 ? (
            <MatchList matches={visibleReceivedOffers} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title="아직 받은 제안이 없어요"
              body="내 요청에 제안이 도착하면 여기에서 비교할 수 있어요."
              action={<Button to="/feed" variant="secondary">요청 탐색</Button>}
            />
          )}
        </section>
      ) : null}

      {tab === "selling" ? (
        <section className="my-demand-panel">
          {sellerMatches.length > 0 ? (
            <>
              <div className="my-demand-section-head">
                <div>
                  <h2>진행 중인 제안</h2>
                  <p>상대가 선택한 제안은 채팅에서 다음 거래 단계를 이어가세요.</p>
                </div>
              </div>
              <MatchList matches={sellerMatches} emptyWhenZero={false} />
            </>
          ) : null}

          <div className="my-demand-section-head">
            <div>
              <h2>보낸 제안</h2>
              <p>내가 보낸 제안의 현재 상태예요.</p>
            </div>
          </div>

          {mySellIntents.length > 0 ? (
            <div className="seller-offer-list">
              {[...mySellIntents]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((offer) => {
                  const product = getProduct(offer.productId);
                  const status =
                    offer.status === "OPEN"
                      ? "상대 확인 중"
                      : offer.status === "MATCHED"
                        ? "거래 진행 중"
                        : offer.status === "PAUSED"
                          ? "일시정지"
                          : "종료";
                  return (
                    <Link
                      key={offer.id}
                      to={"/demand/" + offer.productId}
                      className="seller-offer-row"
                    >
                      {product ? <ProductVisual product={product} size="sm" /> : null}
                      <div>
                        <strong>{product?.name ?? "판매 제안"}</strong>
                        <span>{formatWon(offer.minimumPrice)} · {status}</span>
                      </div>
                      <span aria-hidden>›</span>
                    </Link>
                  );
                })}
            </div>
          ) : (
            <EmptyState
              title="보낸 제안이 없어요"
              body="탐색에서 내가 도와줄 수 있는 요청을 찾아 제안해보세요."
              action={<Button to="/feed">요청 탐색</Button>}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
