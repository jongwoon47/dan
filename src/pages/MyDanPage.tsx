import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { MatchList } from "@/components/MatchCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import {
  effectiveDemandStatus,
  isDemandOpen,
} from "@/domain/demandLifecycle";
import { dedupeConnectedMatches } from "@/domain/matchLifecycle";
import { DEMAND_TYPE_LABEL } from "@/domain/types";
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

function demandStatusLabel(d: Parameters<typeof effectiveDemandStatus>[0]) {
  const s = effectiveDemandStatus(d);
  if (s === "ACTIVE") return ko.statusActive;
  if (s === "MATCHED") return ko.statusMatched;
  if (s === "EXPIRED") return ko.statusExpired;
  return ko.statusClosed;
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 3.2.9 4.6 1.6 5.5H4.9c.7-.9 1.6-2.3 1.6-5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 18.5a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatUnreadBadge(count: number): string {
  if (count <= 0) return "";
  if (count > 9) return "9+";
  return String(count);
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

function MySection({
  title,
  children,
  id,
  action,
}: {
  title: string;
  children: ReactNode;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <section className="my-section" id={id}>
      <div className="my-section__head">
        <h2 className="my-section__title">{title}</h2>
        {action}
      </div>
      <div className="my-section__body">{children}</div>
    </section>
  );
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

  const connected = useMemo(
    () => dedupeConnectedMatches(myMatches, currentUser?.id ?? null),
    [myMatches, currentUser?.id],
  );
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

  const openDemands = myDemands.filter((d) => isDemandOpen(d));
  const openResponses = myResponses.filter((r) => r.status === "OPEN");
  const unreadLabel = formatUnreadBadge(unreadActivityCount);

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
    <div className="page-stack my-dan">
      <header className="my-dan__header">
        <div className="my-dan__identity">
          <h1 className="page-title">{ko.myDan}</h1>
          <Link to={`/profile/${currentUser?.id}`} className="my-dan__name">
            {currentUser?.name}
          </Link>
        </div>
        <NavLink
          to="/activity"
          className="my-dan__bell"
          aria-label={
            unreadActivityCount > 0
              ? `${ko.navActivity} ${unreadActivityCount}`
              : ko.navActivity
          }
        >
          <span className="my-dan__bell-wrap">
            <IconBell />
            {unreadLabel ? (
              <span className="nav-badge nav-badge--float">{unreadLabel}</span>
            ) : null}
          </span>
        </NavLink>
      </header>

      <MySection title={ko.attentionTitle}>
        {nowItems.length === 0 ? (
          <p className="my-section__empty">{ko.nowEmpty}</p>
        ) : (
          <div className="app-row-list app-row-list--inset">
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
      </MySection>

      <MySection
        title={ko.myRequests}
        action={
          <Link to="/create" className="my-section__action">
            {ko.navCreate}
          </Link>
        }
      >
        {openDemands.length === 0 ? (
          <p className="my-section__empty">
            {ko.emptyFeedBody}{" "}
            <Link to="/create" className="text-link">
              {ko.navCreate}
            </Link>
          </p>
        ) : (
          <div className="app-row-list app-row-list--inset">
            {openDemands.map((d) => (
              <RowLink
                key={d.id}
                to={demandHref(d)}
                title={d.title}
                meta={`${DEMAND_TYPE_LABEL[d.type]} · ${demandStatusLabel(d)}`}
                trailing={d.budget > 0 ? formatWon(d.budget) : undefined}
              />
            ))}
          </div>
        )}
      </MySection>

      <MySection title={ko.connectedPeople} id="connections">
        {connected.length > 0 ? (
          <div className="app-row-list app-row-list--inset">
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
                  trailing={
                    <span className="app-row__trail-cta">{ko.openChat}</span>
                  }
                />
              );
            })}
          </div>
        ) : (
          <p className="my-section__empty">아직 연결된 사람이 없어요.</p>
        )}
      </MySection>

      {pendingMatches.length > 0 ? (
        <MySection title={ko.pendingMatches}>
          <div className="my-section__pad">
            <MatchList matches={pendingMatches} emptyWhenZero={false} />
          </div>
        </MySection>
      ) : null}

      <section className="my-section my-section--quiet">
        <button
          type="button"
          className="disclosure-row disclosure-row--panel"
          aria-expanded={vaultOpen}
          onClick={() => setVaultOpen((v) => !v)}
        >
          <span>{ko.myVault}</span>
          <span aria-hidden>{vaultOpen ? "∧" : "›"}</span>
        </button>
        {vaultOpen ? (
          <div className="vault-panel">
            <h3 className="my-section__subtitle">{ko.myItems}</h3>
            {myOwnerships.length === 0 ? (
              <p className="my-section__empty">{ko.missingOwnBody}</p>
            ) : (
              <div className="app-row-list app-row-list--inset">
                {myOwnerships.map((o) => {
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
                })}
              </div>
            )}
            <h3 className="my-section__subtitle">{ko.myResponses}</h3>
            {openResponses.length === 0 ? (
              <p className="my-section__empty">{ko.noMatchBody}</p>
            ) : (
              <div className="app-row-list app-row-list--inset">
                {openResponses.map((r) => (
                  <RowLink
                    key={r.id}
                    to={`/demand/item/${r.demandId}`}
                    title={r.message || ko.respondCta}
                    trailing={responseLabel(r.status)}
                  />
                ))}
              </div>
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
