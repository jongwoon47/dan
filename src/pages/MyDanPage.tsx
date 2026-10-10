import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MatchList } from "@/components/MatchCard";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDanCopy, type LocalizedCopy } from "@/copy/useDanCopy";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { effectiveDemandStatus } from "@/domain/demandLifecycle";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { DEMAND_TYPE_LABEL, isBuyDemand } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

type MyTab = "active" | "requests" | "completed";

function normalizeTab(value: string | null): MyTab {
  if (value === "requests" || value === "completed") return value;
  return "active";
}

function requestStatusLabel(status: string, copy: LocalizedCopy): string {
  if (status === "MATCHED") return copy.tradeInProgress;
  if (status === "EXPIRED") return copy.statusExpired;
  if (status === "CLOSED") return copy.matchStatusClosed;
  return copy.statusActive;
}

export function MyDanPage() {
  const locale = useDanLocale();
  const copy = useDanCopy();
  const ja = locale === "ja";
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
        title={copy.needLogin}
        body={copy.needLoginBody}
        action={
          dataMode === "supabase" ? (
            <Button to="/login">{copy.login}</Button>
          ) : (
            <Button onClick={() => login()}>{copy.login}</Button>
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
          <h1 className="page-title">{ja ? "自分の取引" : "내 거래"}</h1>
        </div>
        <div className="my-dan__actions">
          <Link to={"/profile/" + currentUser?.id} className="my-dan__name">
            {copy.profileTitle} <span aria-hidden>›</span>
          </Link>
          <Link
            to="/settings"
            className="my-dan__settings"
            aria-label={ja ? "設定" : "설정"}
          >
            {ja ? "設定" : "설정"}
          </Link>
        </div>
      </header>

      <nav className="my-demand-tabs" aria-label={ja ? "自分の取引メニュー" : "내 거래 메뉴"}>
        <button
          type="button"
          className={tab === "active" ? "is-active" : ""}
          onClick={() => changeTab("active")}
        >
          {copy.myRequestsActive}
          <span>{activeMatches.length}</span>
        </button>
        <button
          type="button"
          className={tab === "requests" ? "is-active" : ""}
          onClick={() => changeTab("requests")}
        >
          {copy.myRequests}
          <span>{requestRows.length}</span>
        </button>
        <button
          type="button"
          className={tab === "completed" ? "is-active" : ""}
          onClick={() => changeTab("completed")}
        >
          {copy.matchStatusCompleted}
          <span>{completedMatches.length}</span>
        </button>
      </nav>

      {tab === "active" ? (
        <section className="my-demand-panel">
          <div className="my-demand-section-head">
            <div>
              <h2>{ja ? "今つなげる取引" : "지금 이어가야 할 거래"}</h2>
              <p>
                {ja
                  ? "新しい提案からチャット、条件確認、支払い・受け渡しまで、ここで続けられます。"
                  : "새 제안부터 채팅, 조건 확인, 결제·인계까지 한곳에서 이어갈 수 있어요."}
              </p>
            </div>
          </div>
          {activeMatches.length > 0 ? (
            <MatchList matches={activeMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title={ja ? "進行中の取引はありません" : "진행 중인 거래가 없어요"}
              body={
                ja
                  ? "依頼を出すか、探す画面で他の人の依頼に応えてみてください。"
                  : "요청을 올리거나 탐색에서 다른 사람의 요청에 제안해보세요."
              }
              action={
                <Button to="/feed" variant="secondary">
                  {copy.ctaBrowse}
                </Button>
              }
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
                        <span>{requestStatusLabel(status, copy)}</span>
                      </div>
                      <p>
                        {DEMAND_TYPE_LABEL[demand.type]} ·{" "}
                        {formatStoredMoney(demand.budget, demand.currencyCode ?? "KRW", locale)}
                      </p>
                      <small>{formatFulfillmentSummary(demand.fulfillmentOptions, locale)}</small>
                    </div>
                    <span className="my-demand-card__chevron" aria-hidden>›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={copy.emptyMyRequests}
              body={
                ja
                  ? "購入、レンタル、おつかい、サービスから必要な依頼を出してみましょう。"
                  : "구매, 빌리기, 심부름, 서비스 중 필요한 요청을 올려보세요."
              }
              action={<Button to="/create">{copy.ctaCreate}</Button>}
            />
          )}

          <Button to="/create" variant="secondary" fullWidth>
            {ja ? "新しい依頼を出す" : "새 요청 올리기"}
          </Button>
        </section>
      ) : null}

      {tab === "completed" ? (
        <section className="my-demand-panel">
          <div className="my-demand-section-head">
            <div>
              <h2>{ja ? "完了した取引" : "완료된 거래"}</h2>
              <p>
                {ja
                  ? "確定した取引結果と相手情報を再度確認できます。"
                  : "확정된 거래 결과와 상대 정보를 다시 확인할 수 있어요."}
              </p>
            </div>
          </div>
          {completedMatches.length > 0 ? (
            <MatchList matches={completedMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title={ja ? "完了した取引はまだありません" : "완료된 거래가 아직 없어요"}
              body={
                ja
                  ? "取引が終わるとここに記録されます。"
                  : "거래가 끝나면 여기에 기록됩니다."
              }
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
