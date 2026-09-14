import { useEffect, useMemo, useState } from "react";
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

function demandHref(d: { id: string; type: string }) {
  return `/demand/item/${d.id}`;
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
    getDemand,
    getPublicProfile,
    resetDemo,
  } = useDan();
  const dataMode = getDataMode();
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});

  const connected = myMatches.filter((m) => m.status === "CONNECTED");
  const peerKey = useMemo(
    () =>
      connected
        .map((m) =>
          currentUser?.id === m.buyerId ? m.sellerId : m.buyerId,
        )
        .join(","),
    [connected, currentUser?.id],
  );

  useEffect(() => {
    if (!peerKey) return;
    const ids = [...new Set(peerKey.split(",").filter(Boolean))];
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        ids.map(async (id) => {
          const p = await getPublicProfile(id);
          next[id] = p?.displayName ?? "상대";
        }),
      );
      if (!cancelled) setPeerNames((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [peerKey, getPublicProfile]);

  const nowItems = useMemo(() => {
    const items: { key: string; text: string; sub?: string; to: string }[] = [];
    for (const ev of activities.filter((a) => !a.readAt).slice(0, 3)) {
      const demand = ev.demandId ? getDemand(ev.demandId) : undefined;
      const to =
        ev.matchId &&
        (ev.kind === "NEW_MESSAGE" || ev.kind === "MATCH_CONNECTED")
          ? `/match/${ev.matchId}`
          : ev.kind === "BUYER_INTEREST" && demand?.type === "BUY"
            ? `/demand/${demand.details.productId}`
            : ev.demandId
              ? `/demand/item/${ev.demandId}`
              : "/activity";
      items.push({
        key: ev.id,
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
        sub: demand?.title,
        to,
      });
    }
    if (myMatches.some((m) => m.status === "BUYER_INTERESTED")) {
      items.push({
        key: "interest",
        text: ko.signalMatch,
        to: "/my#connections",
      });
    }
    for (const own of myOwnerships) {
      const agg = getAggregate(own.productId);
      if (agg && agg.seekerCount > 0) {
        items.push({
          key: own.id,
          text: `${ko.signalOwned} (${agg.seekerCount}${ko.myung})`,
          to: `/demand/${own.productId}`,
        });
        break;
      }
    }
    return items.slice(0, 4);
  }, [activities, myMatches, myOwnerships, getAggregate, getDemand]);

  const activeDemands = myDemands.filter((d) => d.status === "ACTIVE");
  const openResponses = myResponses.filter((r) => r.status === "OPEN");

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
        {nowItems.length === 0 ? (
          <p className="section-desc">{ko.activityEmpty}</p>
        ) : (
          <ul className="signal-list">
            {nowItems.map((item) => (
              <li key={item.key}>
                <Link to={item.to}>
                  <strong>{item.text}</strong>
                  {item.sub ? <span className="muted"> · {item.sub}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-stack">
        <h2 className="section-title">{ko.myRequests}</h2>
        {activeDemands.length === 0 ? (
          <p className="section-desc">
            {ko.emptyFeedBody}{" "}
            <Link to="/create" className="text-link">
              {ko.navCreate}
            </Link>
          </p>
        ) : (
          activeDemands.map((d) => (
            <Link key={d.id} className="simple-row" to={demandHref(d)}>
              <strong>{d.title}</strong>
              <span>{formatWon(d.budget)}</span>
            </Link>
          ))
        )}
      </section>

      <section className="section-stack" id="connections">
        <h2 className="section-title">{ko.myConnections}</h2>
        {connected.length > 0 ? (
          <div className="section-stack">
            {connected.map((m) => {
              const peerId =
                currentUser?.id === m.buyerId ? m.sellerId : m.buyerId;
              const demand = getDemand(m.demandId);
              const peer = peerNames[peerId] ?? "상대";
              return (
                <Link key={m.id} className="simple-row" to={`/match/${m.id}`}>
                  <strong>
                    {peer}
                    {demand?.title ? ` · ${demand.title}` : ""}
                  </strong>
                  <span>{ko.openChat}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
        <MatchList
          matches={myMatches.filter((m) => m.status !== "CONNECTED")}
        />
      </section>

      <details className="my-vault">
        <summary>
          {ko.myItems} · {ko.myResponses}
        </summary>
        <div className="section-stack">
          <h3 className="section-title">{ko.myItems}</h3>
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
                  <Link to={`/ownership/${o.id}/sell-intent`}>
                    {sell ? formatWon(sell.minimumPrice) : ko.sellCta}
                  </Link>
                </div>
              );
            })
          )}
          <h3 className="section-title">{ko.myResponses}</h3>
          {openResponses.length === 0 ? (
            <p className="section-desc">{ko.noMatchBody}</p>
          ) : (
            openResponses.map((r) => (
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
        </div>
      </details>

      {dataMode === "demo" ? (
        <Button variant="ghost" onClick={resetDemo}>
          {ko.resetDemo}
        </Button>
      ) : null}
    </div>
  );
}
