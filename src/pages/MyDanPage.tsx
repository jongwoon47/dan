import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MatchList } from "@/components/MatchCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { formatWon } from "@/lib/format";
import "./pages.css";

function responseLabel(status: string) {
  if (status === "OPEN") return ko.statusOpen;
  if (status === "ACCEPTED") return ko.statusAccepted;
  if (status === "DECLINED") return ko.statusDeclined;
  if (status === "WITHDRAWN") return ko.statusWithdrawn;
  return status;
}

function demandLabel(status: string) {
  if (status === "ACTIVE") return ko.statusActive;
  if (status === "CLOSED") return ko.statusClosed;
  if (status === "MATCHED") return ko.statusMatched;
  return status;
}

export function MyDanPage() {
  const {
    isLoggedIn,
    login,
    currentUser,
    myDemands,
    myOwnerships,
    mySellIntents,
    myResponses,
    myMatches,
    getProduct,
    getAggregate,
    activities,
    unreadActivityCount,
    resetDemo,
  } = useDan();
  const dataMode = getDataMode();

  const attention = useMemo(() => {
    const items: { text: string; to: string }[] = [];
    for (const ev of activities.filter((a) => !a.readAt).slice(0, 5)) {
      items.push({
        text:
          ev.kind === "NEW_RESPONSE"
            ? ko.activityNewResponse
            : ev.kind === "BUYER_INTEREST"
              ? ko.activityInterest
              : ev.kind === "NEW_MESSAGE"
                ? ko.activityMessage
                : ev.kind === "MATCH_CONNECTED"
                  ? ko.activityConnected
                  : ko.attentionTitle,
        to:
          ev.matchId && (ev.kind === "NEW_MESSAGE" || ev.kind === "MATCH_CONNECTED")
            ? `/match/${ev.matchId}`
            : ev.demandId
              ? `/demand/item/${ev.demandId}`
              : "/activity",
      });
    }
    if (myMatches.some((m) => m.status === "BUYER_INTERESTED")) {
      items.push({ text: ko.signalMatch, to: "/my" });
    }
    for (const own of myOwnerships) {
      const agg = getAggregate(own.productId);
      if (agg && agg.seekerCount > 0) {
        items.push({
          text: `${ko.signalOwned} (${agg.seekerCount}${ko.myung})`,
          to: `/demand/${own.productId}`,
        });
        break;
      }
    }
    return items;
  }, [activities, myMatches, myOwnerships, getAggregate]);

  const activeDemands = myDemands.filter((d) => d.status === "ACTIVE");
  const otherDemands = myDemands.filter((d) => d.status !== "ACTIVE");
  const connected = myMatches.filter((m) => m.status === "CONNECTED");

  if (!isLoggedIn) {
    return (
      <EmptyState
        title={ko.needLogin}
        body={ko.needLoginBody}
        action={
          dataMode === "supabase" ? (
            <Button to="/login">{ko.login}</Button>
          ) : (
            <Button onClick={() => login()}>{ko.demoLogin}</Button>
          )
        }
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header page-header--row">
        <div>
          <h1 className="page-title">{ko.myDan}</h1>
          <p className="section-desc">
            <Link to={`/profile/${currentUser?.id}`} className="text-link">
              {currentUser?.name}
            </Link>
            {ko.myDescSuffix}
          </p>
        </div>
        <Button to="/activity" variant="secondary" size="sm">
          {ko.navActivity}
          {unreadActivityCount > 0 ? ` ${unreadActivityCount}` : ""}
        </Button>
      </header>

      <section className="section-stack">
        <h2 className="section-title">{ko.attentionTitle}</h2>
        {attention.length === 0 ? (
          <p className="section-desc">{ko.activityEmpty}</p>
        ) : (
          <ul className="signal-list">
            {attention.map((item) => (
              <li key={item.text + item.to}>
                <Link to={item.to}>{item.text}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-stack">
        <h2 className="section-title">
          {ko.myRequests} · {ko.myRequestsActive}
        </h2>
        {activeDemands.length === 0 ? (
          <p className="section-desc">{ko.emptyFeedBody}</p>
        ) : (
          activeDemands.map((d) => (
            <Link
              key={d.id}
              className="simple-row"
              to={
                d.type === "BUY"
                  ? `/demand/${d.details.productId}`
                  : `/demand/item/${d.id}`
              }
            >
              <strong>{d.title}</strong>
              <span>
                {demandLabel(d.status)} · {formatWon(d.budget)}
              </span>
            </Link>
          ))
        )}
      </section>

      {otherDemands.length > 0 ? (
        <section className="section-stack">
          <h2 className="section-title">{ko.myRequestsDone}</h2>
          {otherDemands.map((d) => (
            <Link
              key={d.id}
              className="simple-row"
              to={
                d.type === "BUY"
                  ? `/demand/${d.details.productId}`
                  : `/demand/item/${d.id}`
              }
            >
              <strong>{d.title}</strong>
              <span>{demandLabel(d.status)}</span>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="section-stack">
        <h2 className="section-title">{ko.myResponses}</h2>
        {myResponses.length === 0 ? (
          <p className="section-desc">{ko.noMatchBody}</p>
        ) : (
          myResponses.map((r) => (
            <Link
              key={r.id}
              className="simple-row"
              to={`/demand/item/${r.demandId}`}
            >
              <strong>{r.message}</strong>
              <span>{responseLabel(r.status)}</span>
            </Link>
          ))
        )}
      </section>

      <section className="section-stack">
        <h2 className="section-title">{ko.myItems}</h2>
        {myOwnerships.length === 0 ? (
          <p className="section-desc">{ko.missingOwnBody}</p>
        ) : (
          myOwnerships.map((o) => {
            const product = getProduct(o.productId);
            const sell = mySellIntents.find(
              (s) => s.ownershipId === o.id && s.status === "OPEN",
            );
            return (
              <div key={o.id} className="simple-row">
                <strong>{product?.name ?? o.productId}</strong>
                {sell ? (
                  <Link to={`/ownership/${o.id}/sell-intent`}>
                    {formatWon(sell.minimumPrice)}
                  </Link>
                ) : (
                  <Link to={`/ownership/${o.id}/sell-intent`}>{ko.sellCta}</Link>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className="section-stack">
        <h2 className="section-title">{ko.myConnections}</h2>
        {connected.length > 0 ? (
          <div className="section-stack">
            {connected.map((m) => (
              <Link key={m.id} className="simple-row" to={`/match/${m.id}`}>
                <strong>{ko.openChat}</strong>
                <span>{ko.statusConnected}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <MatchList matches={myMatches} />
      </section>

      {dataMode === "demo" ? (
        <Button variant="ghost" onClick={resetDemo}>
          {ko.resetDemo}
        </Button>
      ) : null}
    </div>
  );
}
