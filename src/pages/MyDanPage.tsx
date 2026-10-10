import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MatchList } from "@/components/MatchCard";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { demandTypeLabel } from "@/copy/demandTypeLabel";
import { useDanCopy, type LocalizedCopy } from "@/copy/useDanCopy";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { effectiveDemandStatus } from "@/domain/demandLifecycle";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { isBuyDemand } from "@/domain/types";
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
          <h1 className="page-title">{copy.dealMyTrades}</h1>
        </div>
        <div className="my-dan__actions">
          <Link to={"/profile/" + currentUser?.id} className="my-dan__name">
            {copy.profileTitle} <span aria-hidden>›</span>
          </Link>
          <Link
            to="/settings"
            className="my-dan__settings"
            aria-label={copy.settingsLink}
          >
            {copy.settingsLink}
          </Link>
        </div>
      </header>

      <nav className="my-demand-tabs" aria-label={copy.myTradesMenuAria}>
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
              <h2>{copy.myActiveNowTitle}</h2>
              <p>{copy.myActiveNowBody}</p>
            </div>
          </div>
          {activeMatches.length > 0 ? (
            <MatchList matches={activeMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title={copy.myActiveEmptyTitle}
              body={copy.myActiveEmptyBody}
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
                        {demandTypeLabel(demand.type, copy).slice(0, 1)}
                      </span>
                    )}
                    <div className="my-demand-card__body">
                      <div className="my-demand-card__head">
                        <strong>{demand.title}</strong>
                        <span>{requestStatusLabel(status, copy)}</span>
                      </div>
                      <p>
                        {demandTypeLabel(demand.type, copy)} ·{" "}
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
              body={copy.emptyMyRequestsBody}
              action={<Button to="/create">{copy.ctaCreate}</Button>}
            />
          )}

          <Button to="/create" variant="secondary" fullWidth>
            {copy.createNewRequestCta}
          </Button>
        </section>
      ) : null}

      {tab === "completed" ? (
        <section className="my-demand-panel">
          <div className="my-demand-section-head">
            <div>
              <h2>{copy.myCompletedTitle}</h2>
              <p>{copy.myCompletedBody}</p>
            </div>
          </div>
          {completedMatches.length > 0 ? (
            <MatchList matches={completedMatches} emptyWhenZero={false} />
          ) : (
            <EmptyState
              title={copy.myCompletedEmptyTitle}
              body={copy.myCompletedEmptyBody}
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
