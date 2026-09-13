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
    resetDemo,
  } = useDan();
  const dataMode = getDataMode();

  const attention = useMemo(() => {
    const items: string[] = [];
    if (myMatches.some((m) => m.status === "POTENTIAL" || m.status === "BUYER_INTERESTED")) {
      items.push(ko.signalMatch);
    }
    for (const own of myOwnerships) {
      const agg = getAggregate(own.productId);
      if (agg && agg.seekerCount > 0) {
        items.push(`${ko.signalOwned} (${agg.seekerCount}${ko.myung})`);
        break;
      }
    }
    if (myResponses.some((r) => r.status === "OPEN")) {
      items.push(ko.signalResponse);
    }
    return items;
  }, [myMatches, myOwnerships, myResponses, getAggregate]);

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
      <header className="page-header">
        <h1 className="page-title">{ko.myDan}</h1>
        <p className="section-desc">
          {currentUser?.name}
          {ko.myDescSuffix}
        </p>
      </header>

      <section className="section-stack">
        <h2 className="section-title">{ko.attentionTitle}</h2>
        {attention.length === 0 ? (
          <p className="section-desc">{ko.noMatchBody}</p>
        ) : (
          <ul className="signal-list">
            {attention.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-stack">
        <h2 className="section-title">{ko.myRequests}</h2>
        {myDemands.length === 0 ? (
          <p className="section-desc">{ko.emptyFeedBody}</p>
        ) : (
          myDemands.slice(0, 6).map((d) => (
            <Link
              key={d.id}
              className="simple-row"
              to={d.type === "BUY" ? `/demand/${d.details.productId}` : `/demand/item/${d.id}`}
            >
              <strong>{d.title}</strong>
              <span>{formatWon(d.budget)}</span>
            </Link>
          ))
        )}
      </section>

      <section className="section-stack">
        <h2 className="section-title">{ko.myResponses}</h2>
        {myResponses.length === 0 ? (
          <p className="section-desc">{ko.noMatchBody}</p>
        ) : (
          myResponses.map((r) => (
            <div key={r.id} className="simple-row">
              <strong>{r.message}</strong>
              <span>{r.status}</span>
            </div>
          ))
        )}
      </section>

      <section className="section-stack">
        <h2 className="section-title">{ko.myConnections}</h2>
        <MatchList matches={myMatches} />
      </section>

      <section className="section-stack">
        <h2 className="section-title">{ko.myItems}</h2>
        {myOwnerships.length === 0 ? (
          <p className="section-desc">{ko.missingOwnBody}</p>
        ) : (
          myOwnerships.map((o) => {
            const product = getProduct(o.productId);
            const sell = mySellIntents.find((s) => s.ownershipId === o.id && s.status === "OPEN");
            return (
              <div key={o.id} className="simple-row">
                <strong>{product?.name ?? o.productId}</strong>
                {sell ? (
                  <Link to={`/ownership/${o.id}/sell-intent`}>{formatWon(sell.minimumPrice)}</Link>
                ) : (
                  <Link to={`/ownership/${o.id}/sell-intent`}>{ko.sellCta}</Link>
                )}
              </div>
            );
          })
        )}
      </section>

      {dataMode === "demo" ? (
        <Button variant="ghost" onClick={resetDemo}>
          {ko.resetDemo}
        </Button>
      ) : null}
    </div>
  );
}
