import { useEffect, useMemo, useState, type ReactNode } from "react";
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

function RowLink({
  to,
  title,
  meta,
  trailing,
  leading,
}: {
  to: string;
  title: string;
  meta?: string;
  trailing?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <Link to={to} className="app-row">
      {leading ? <span className="app-row__leading">{leading}</span> : null}
      <span className="app-row__body">
        <strong>{title}</strong>
        {meta ? <span className="app-row__meta">{meta}</span> : null}
      </span>
      {trailing ? <span className="app-row__trail">{trailing}</span> : null}
      <span className="app-row__chevron" aria-hidden>
        ›
      </span>
    </Link>
  );
}

function initialOf(name: string) {
  return (name.trim().slice(0, 1) || "?").toUpperCase();
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
  const [vaultOpen, setVaultOpen] = useState(false);

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
    const unread = activities.filter((a) => !a.readAt);
    const seenTo = new Set<string>();

    function push(item: { key: string; text: string; sub?: string; to: string }) {
      if (seenTo.has(item.to)) return;
      seenTo.add(item.to);
      items.push(item);
    }

    for (const ev of unread.slice(0, 5)) {
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
      push({
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

    const hasUnreadBuyerInterest = unread.some(
      (a) => a.kind === "BUYER_INTEREST",
    );
    if (
      myMatches.some((m) => m.status === "BUYER_INTERESTED") &&
      !hasUnreadBuyerInterest
    ) {
      push({
        key: "interest",
        text: ko.signalMatch,
        to: "/my#connections",
      });
    }

    for (const own of myOwnerships) {
      const agg = getAggregate(own.productId);
      const to = `/demand/${own.productId}`;
      if (!agg || agg.seekerCount <= 0) continue;
      // Same product already covered by unread BUYER_INTEREST activity.
      if (seenTo.has(to)) continue;
      push({
        key: own.id,
        text: `${ko.signalOwned} (${agg.seekerCount}${ko.myung})`,
        to,
      });
      break;
    }

    return items.slice(0, 4);
  }, [activities, myMatches, myOwnerships, getAggregate, getDemand]);

  const pendingMatches = useMemo(
    () => myMatches.filter((m) => m.status !== "CONNECTED"),
    [myMatches],
  );

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
            <Button onClick={() => login()}>{ko.login}</Button>
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
          <p className="section-desc">{ko.nowEmpty}</p>
        ) : (
          <div className="app-row-list">
            {nowItems.map((item) => (
              <RowLink
                key={item.key}
                to={item.to}
                title={item.text}
                meta={item.sub}
              />
            ))}
          </div>
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
          <div className="app-row-list">
            {activeDemands.map((d) => (
              <RowLink
                key={d.id}
                to={demandHref(d)}
                title={d.title}
                meta={ko.statusActive}
                trailing={d.budget > 0 ? formatWon(d.budget) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section className="section-stack" id="connections">
        <h2 className="section-title">{ko.connectedPeople}</h2>
        {connected.length > 0 ? (
          <div className="app-row-list">
            {connected.map((m) => {
              const peerId =
                currentUser?.id === m.buyerId ? m.sellerId : m.buyerId;
              const demand = getDemand(m.demandId);
              const peer = peerNames[peerId] ?? "상대";
              return (
                <RowLink
                  key={m.id}
                  to={`/match/${m.id}`}
                  title={peer}
                  meta={demand?.title}
                  leading={
                    <span className="avatar-initial" aria-hidden>
                      {initialOf(peer)}
                    </span>
                  }
                  trailing={ko.openChat}
                />
              );
            })}
          </div>
        ) : (
          <p className="section-desc">아직 연결된 사람이 없어요.</p>
        )}
      </section>

      {pendingMatches.length > 0 ? (
        <section className="section-stack">
          <h2 className="section-title">{ko.pendingMatches}</h2>
          <MatchList matches={pendingMatches} emptyWhenZero={false} />
        </section>
      ) : null}

      <section className="section-stack">
        <button
          type="button"
          className="disclosure-row"
          aria-expanded={vaultOpen}
          onClick={() => setVaultOpen((v) => !v)}
        >
          <span>{ko.myVault}</span>
          <span aria-hidden>{vaultOpen ? "∧" : "›"}</span>
        </button>
        {vaultOpen ? (
          <div className="section-stack vault-panel">
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
                  <RowLink
                    key={o.id}
                    to={`/ownership/${o.id}/sell-intent`}
                    title={product?.name ?? o.productId}
                    trailing={
                      sell && sell.minimumPrice > 0
                        ? formatWon(sell.minimumPrice)
                        : ko.sellCta
                    }
                  />
                );
              })
            )}
            <h3 className="section-title">{ko.myResponses}</h3>
            {openResponses.length === 0 ? (
              <p className="section-desc">{ko.noMatchBody}</p>
            ) : (
              openResponses.map((r) => (
                <RowLink
                  key={r.id}
                  to={`/demand/item/${r.demandId}`}
                  title={r.message || ko.respondCta}
                  trailing={responseLabel(r.status)}
                />
              ))
            )}
          </div>
        ) : null}
      </section>

      {dataMode === "demo" ? (
        <Button variant="ghost" onClick={resetDemo}>
          {ko.resetDemo}
        </Button>
      ) : null}
    </div>
  );
}
