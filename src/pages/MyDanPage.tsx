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
import { isBuyDemand, type BuyDemand } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

type MyTab = "demands" | "offers" | "selling";

function normalizeTab(value: string | null): MyTab {
  if (value === "offers" || value === "selling") return value;
  return "demands";
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

  const openBuyDemands = useMemo(
    () =>
      myDemands.filter((demand): demand is BuyDemand => {
        if (!isBuyDemand(demand)) return false;
        const status = effectiveDemandStatus(demand);
        return status === "ACTIVE" || status === "MATCHED";
      }),
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

  const offerCountByDemand = useMemo(() => {
    const map = new Map<string, number>();
    for (const match of receivedOffers) {
      map.set(match.demandId, (map.get(match.demandId) ?? 0) + 1);
    }
    return map;
  }, [receivedOffers]);

  if (!isLoggedIn) {
    return (
      <EmptyState
        title="로그인이 필요해요"
        body="내 구매수요와 받은 제안을 확인하려면 로그인해 주세요."
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
          <p className="eyebrow">My Demand</p>
          <h1 className="page-title">내 구매수요</h1>
        </div>
        <Link to={"/profile/" + currentUser?.id} className="my-dan__name">
          프로필
        </Link>
      </header>

      <nav className="my-demand-tabs" aria-label="내 거래 메뉴">
        <button
          type="button"
          className={tab === "demands" ? "is-active" : ""}
          onClick={() => changeTab("demands")}
        >
          구매수요
          <span>{openBuyDemands.length}</span>
        </button>
        <button
          type="button"
          className={tab === "offers" ? "is-active" : ""}
          onClick={() => changeTab("offers")}
        >
          받은 제안
          <span>{receivedOffers.length}</span>
        </button>
        <button
          type="button"
          className={tab === "selling" ? "is-active" : ""}
          onClick={() => changeTab("selling")}
        >
          판매 제안
          <span>{mySellIntents.length}</span>
        </button>
      </nav>

      {tab === "demands" ? (
        <section className="my-demand-panel">
          {openBuyDemands.length === 0 ? (
            <EmptyState
              title="등록한 구매수요가 없어요"
              body="원하는 카메라와 조건을 먼저 남겨보세요."
              action={<Button to="/buy/new">구매수요 등록</Button>}
            />
          ) : (
            <div className="my-demand-card-list">
              {openBuyDemands.map((demand) => {
                const product = getProduct(demand.details.productId);
                if (!product) return null;
                const offerCount = offerCountByDemand.get(demand.id) ?? 0;
                return (
                  <Link key={demand.id} to={"/demand/item/" + demand.id} className="my-demand-card">
                    <ProductVisual product={product} size="sm" />
                    <div className="my-demand-card__body">
                      <div className="my-demand-card__head">
                        <strong>{product.name}</strong>
                        <span>{effectiveDemandStatus(demand) === "MATCHED" ? "거래 진행" : "구매중"}</span>
                      </div>
                      <p>최대 {formatWon(demand.details.maxPrice)}</p>
                      <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
                    </div>
                    <div className="my-demand-card__offer">
                      <strong>{offerCount}</strong>
                      <span>제안</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <Button to="/buy/new" fullWidth size="lg">
            새 구매수요 등록
          </Button>
        </section>
      ) : null}

      {tab === "offers" ? (
        <section className="my-demand-panel">
          <div className="my-demand-section-head">
            <div>
              <h2>받은 제안</h2>
              <p>가격과 기본 상태를 비교한 뒤 제안 상세에서 관심을 표시하세요.</p>
            </div>
          </div>
          {receivedOffers.length > 0 ? (
            <MatchList matches={receivedOffers} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title="아직 받은 제안이 없어요"
              body="구매수요를 본 판매자가 Quick Offer를 보내면 여기에 표시돼요."
              action={<Button to="/" variant="secondary">Live Demand 보기</Button>}
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
                  <h2>구매자 반응</h2>
                  <p>구매자가 관심을 보인 제안부터 증거 제출과 거래 조건 확정을 진행하세요.</p>
                </div>
              </div>
              <MatchList matches={sellerMatches} emptyWhenZero={false} />
            </>
          ) : null}

          <div className="my-demand-section-head">
            <div>
              <h2>보낸 Quick Offer</h2>
              <p>내가 보낸 판매 제안의 현재 상태예요.</p>
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
                      ? "구매자 검토 대기"
                      : offer.status === "MATCHED"
                        ? "거래 진행 중"
                        : offer.status === "PAUSED"
                          ? "일시정지"
                          : "종료";
                  return (
                    <Link key={offer.id} to={"/demand/" + offer.productId} className="seller-offer-row">
                      <ProductVisual product={product!} size="sm" />
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
              title="보낸 판매 제안이 없어요"
              body="Live Demand에서 판매할 수 있는 카메라를 선택해 Quick Offer를 보내세요."
              action={<Button to="/">구매수요 보기</Button>}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
