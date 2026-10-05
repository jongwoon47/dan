import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { effectiveDemandStatus } from "@/domain/demandLifecycle";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import type { Demand, DemandType, Match } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

type MyTab = "progress" | "requests" | "completed";

const TYPE_LABEL: Record<DemandType, string> = {
  BUY: "구매",
  BORROW: "빌리기",
  TASK: "심부름",
  SERVICE: "서비스",
};

function normalizeTab(value: string | null): MyTab {
  if (value === "completed") return "completed";
  if (value === "requests" || value === "demands") return "requests";
  return "progress";
}

function demandAmount(demand: Demand): number {
  return demand.type === "BUY" ? demand.details.maxPrice : demand.budget;
}

function matchStatusLabel(match: Match): string {
  if (match.status === "COMPLETED") return "거래 완료";
  if (match.status === "BUYER_INTERESTED") return "제안 확인 중";
  if (match.status === "SELLER_ACCEPTED") return "연결 대기";
  if (match.status === "CONNECTED") {
    switch (match.dealStage) {
      case "EVIDENCE_PENDING": return "상품 정보 필요";
      case "EVIDENCE_READY":
      case "DEAL_REVIEW": return "거래 조건 확인";
      case "DEAL_LOCKED":
      case "PAYMENT_PENDING": return "결제 필요";
      case "PAID":
      case "HANDOFF_READY": return "인계 확인";
      default: return "채팅 중";
    }
  }
  return "진행 중";
}

export function MyDanPage() {
  const {
    isLoggedIn,
    login,
    currentUser,
    myDemands,
    myMatches,
    getProduct,
    getDemand,
  } = useDan();
  const dataMode = getDataMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = normalizeTab(searchParams.get("tab"));

  const activeMatches = useMemo(
    () =>
      myMatches
        .filter((match) => !["COMPLETED", "CLOSED", "DECLINED"].includes(match.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [myMatches],
  );

  const completedMatches = useMemo(
    () =>
      myMatches
        .filter((match) => match.status === "COMPLETED")
        .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)),
    [myMatches],
  );

  const visibleRequests = useMemo(
    () =>
      myDemands
        .filter((demand) => ["ACTIVE", "MATCHED"].includes(effectiveDemandStatus(demand)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [myDemands],
  );

  const responseCountByDemand = useMemo(() => {
    const map = new Map<string, number>();
    for (const match of myMatches) {
      if (["CLOSED", "DECLINED"].includes(match.status)) continue;
      map.set(match.demandId, (map.get(match.demandId) ?? 0) + 1);
    }
    return map;
  }, [myMatches]);

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
    setSearchParams(next === "progress" ? {} : { tab: next });
  }

  function renderMatchRow(match: Match, completed = false) {
    const demand = getDemand(match.demandId);
    if (!demand) return null;
    const product = match.productId ? getProduct(match.productId) : undefined;
    const href =
      completed
        ? `/deal/${match.id}/complete`
        : match.status === "POTENTIAL" || match.status === "BUYER_INTERESTED"
          ? `/offer/${match.id}`
          : `/match/${match.id}`;

    return (
      <Link key={match.id} to={href} className="app-trade-row">
        <div className="app-trade-row__media">
          {product ? (
            <ProductVisual product={product} size="sm" />
          ) : (
            <span className="app-trade-row__type">{TYPE_LABEL[demand.type].slice(0, 1)}</span>
          )}
        </div>
        <div className="app-trade-row__body">
          <div className="app-trade-row__top">
            <strong>{product?.name ?? demand.title}</strong>
            <span>{formatWon(demandAmount(demand))}</span>
          </div>
          <p>{TYPE_LABEL[demand.type]} · {matchStatusLabel(match)}</p>
          <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
        </div>
        <span className="app-trade-row__arrow" aria-hidden>›</span>
      </Link>
    );
  }

  return (
    <div className="page-stack my-dan my-dan--app">
      <header className="app-page-head app-page-head--profile">
        <div>
          <span>내 거래</span>
          <h1>거래를 한곳에서 관리해요</h1>
        </div>
        <Link to={`/profile/${currentUser?.id}`} className="app-page-head__profile">
          {currentUser?.name.trim().slice(0, 1) || "나"}
        </Link>
      </header>

      <nav className="app-tabs" aria-label="내 거래 메뉴">
        <button className={tab === "progress" ? "is-active" : ""} onClick={() => changeTab("progress")}>
          진행 중 <span>{activeMatches.length}</span>
        </button>
        <button className={tab === "requests" ? "is-active" : ""} onClick={() => changeTab("requests")}>
          내 요청 <span>{visibleRequests.length}</span>
        </button>
        <button className={tab === "completed" ? "is-active" : ""} onClick={() => changeTab("completed")}>
          완료 <span>{completedMatches.length}</span>
        </button>
      </nav>

      {tab === "progress" ? (
        <section className="app-trade-section">
          <div className="app-section-head">
            <h2>지금 할 일이 있는 거래</h2>
            <span>제안부터 인계까지 현재 상태를 보여줘요.</span>
          </div>
          {activeMatches.length > 0 ? (
            <div className="app-trade-list">{activeMatches.map((match) => renderMatchRow(match))}</div>
          ) : (
            <EmptyState
              title="진행 중인 거래가 없어요"
              body="요청을 올리거나 탐색에서 제안을 보내면 여기에 표시돼요."
              action={<Button to="/create">새 요청 만들기</Button>}
            />
          )}
        </section>
      ) : null}

      {tab === "requests" ? (
        <section className="app-trade-section">
          <div className="app-section-head app-section-head--row">
            <div>
              <h2>내가 올린 요청</h2>
              <span>구매·빌리기·심부름·서비스 요청을 모두 보여줘요.</span>
            </div>
            <Button to="/create" variant="secondary" size="sm">새 요청</Button>
          </div>
          {visibleRequests.length > 0 ? (
            <div className="app-trade-list">
              {visibleRequests.map((demand) => {
                const product = demand.type === "BUY" ? getProduct(demand.details.productId) : undefined;
                const count = responseCountByDemand.get(demand.id) ?? 0;
                return (
                  <Link key={demand.id} to={`/demand/item/${demand.id}`} className="app-trade-row">
                    <div className="app-trade-row__media">
                      {product ? (
                        <ProductVisual product={product} size="sm" />
                      ) : (
                        <span className="app-trade-row__type">{TYPE_LABEL[demand.type].slice(0, 1)}</span>
                      )}
                    </div>
                    <div className="app-trade-row__body">
                      <div className="app-trade-row__top">
                        <strong>{product?.name ?? demand.title}</strong>
                        <span>{formatWon(demandAmount(demand))}</span>
                      </div>
                      <p>{TYPE_LABEL[demand.type]} · {count > 0 ? `제안/응답 ${count}개` : "응답 기다리는 중"}</p>
                      <small>{formatFulfillmentSummary(demand.fulfillmentOptions)}</small>
                    </div>
                    <span className="app-trade-row__arrow" aria-hidden>›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="진행 중인 요청이 없어요"
              body="필요한 물건이나 일을 먼저 요청해보세요."
              action={<Button to="/create">요청 만들기</Button>}
            />
          )}
        </section>
      ) : null}

      {tab === "completed" ? (
        <section className="app-trade-section">
          <div className="app-section-head">
            <h2>완료한 거래</h2>
            <span>완료된 거래와 조건을 다시 확인할 수 있어요.</span>
          </div>
          {completedMatches.length > 0 ? (
            <div className="app-trade-list">{completedMatches.map((match) => renderMatchRow(match, true))}</div>
          ) : (
            <EmptyState title="완료한 거래가 아직 없어요" body="거래를 완료하면 이곳에 기록돼요." />
          )}
        </section>
      ) : null}
    </div>
  );
}
