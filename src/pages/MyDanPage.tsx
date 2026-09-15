import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MatchList } from "@/components/MatchCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import {
  effectiveDemandStatus,
  formatExpiredOn,
  isDemandOpen,
} from "@/domain/demandLifecycle";
import type { Demand } from "@/domain/types";
import "./pages.css";

const EXPIRING_SOON_MS = 3 * 86400000;

function responseStatusMeta(status: string) {
  if (status === "OPEN") return ko.statusWaiting;
  if (status === "ACCEPTED") return ko.statusConnected;
  if (status === "DECLINED") return ko.statusDeclined;
  if (status === "WITHDRAWN") return ko.statusWithdrawn;
  return status;
}

function demandHref(d: { id: string }) {
  return `/demand/item/${d.id}`;
}

function daysLeftLabel(demand: Demand, nowMs = Date.now()): string | null {
  const end = new Date(demand.expiresAt).getTime();
  if (!Number.isFinite(end)) return null;
  const days = Math.ceil((end - nowMs) / 86400000);
  if (days < 0) return null;
  if (days === 0) return ko.expiresToday;
  return ko.daysLeft.replace("{n}", String(days));
}

function requestMeta(
  demand: Demand,
  responseCount: number,
  nowMs = Date.now(),
): string {
  const status = effectiveDemandStatus(demand, nowMs);
  if (status === "MATCHED") {
    return responseCount > 0
      ? `${ko.responseCountLabel.replace("{n}", String(responseCount))} · ${ko.statusMatched}`
      : ko.statusMatched;
  }
  if (status === "ACTIVE") {
    const left = daysLeftLabel(demand, nowMs);
    if (responseCount > 0) {
      return `${ko.responseCountLabel.replace("{n}", String(responseCount))} · ${ko.myRequestsActive}`;
    }
    return left ? `${ko.seekingOnly} · ${left}` : ko.seekingOnly;
  }
  if (status === "EXPIRED") return ko.statusExpired;
  return ko.statusClosed;
}

function RowLink({
  to,
  title,
  meta,
  trailing,
}: {
  to: string;
  title: string;
  meta?: string;
  trailing?: ReactNode;
}) {
  return (
    <Link to={to} className="app-row">
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

function MyBlock({
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
    <section className="my-block" id={id}>
      <div className="my-block__head">
        <h2 className="my-block__title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MyDanPage() {
  const {
    isLoggedIn,
    login,
    currentUser,
    myDemands,
    myResponses,
    myMatches,
    activities,
    getDemand,
    state,
    resetDemo,
    extendBuyDemand,
    busy,
  } = useDan();
  const dataMode = getDataMode();
  const [archivedOpen, setArchivedOpen] = useState(false);

  const responseCountByDemand = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of state.responses) {
      if (r.status === "WITHDRAWN") continue;
      map.set(r.demandId, (map.get(r.demandId) ?? 0) + 1);
    }
    return map;
  }, [state.responses]);

  const nowItems = useMemo(() => {
    const items: { key: string; text: string; sub?: string; to: string }[] = [];
    const unread = activities.filter((a) => !a.readAt);
    const seenTo = new Set<string>();
    const nowMs = Date.now();

    function push(item: { key: string; text: string; sub?: string; to: string }) {
      if (seenTo.has(item.to)) return;
      seenTo.add(item.to);
      items.push(item);
    }

    for (const ev of unread) {
      // Chat lives in 대화 — skip outbound-style message noise from My DAN.
      if (ev.kind === "NEW_MESSAGE") continue;
      if (ev.kind === "DEMAND_CLOSED") continue;

      const demand = ev.demandId ? getDemand(ev.demandId) : undefined;
      const actionable =
        ev.kind === "NEW_RESPONSE" ||
        ev.kind === "MATCH_CONNECTED" ||
        ev.kind === "RESPONSE_ACCEPTED" ||
        ev.kind === "BUYER_INTEREST" ||
        ev.kind === "RESPONSE_DECLINED";
      if (!actionable) continue;

      const to =
        ev.matchId &&
        (ev.kind === "MATCH_CONNECTED" || ev.kind === "RESPONSE_ACCEPTED")
          ? `/match/${ev.matchId}`
          : ev.kind === "BUYER_INTEREST" && demand?.type === "BUY"
            ? `/demand/${demand.details.productId}`
            : ev.demandId
              ? `/demand/item/${ev.demandId}`
              : "/activity";

      const text =
        ev.kind === "NEW_RESPONSE"
          ? ko.activityNewResponse
          : ev.kind === "MATCH_CONNECTED"
            ? ko.activityPeerConnected
            : ev.kind === "RESPONSE_ACCEPTED"
              ? ko.activityAccepted
              : ev.kind === "BUYER_INTEREST"
                ? ko.activityInterest
                : ev.kind === "RESPONSE_DECLINED"
                  ? ko.activityDeclined
                  : ko.attentionTitle;

      push({
        key: ev.id,
        text,
        sub: demand?.title,
        to,
      });
    }

    for (const d of myDemands) {
      if (!isDemandOpen(d)) continue;
      const end = new Date(d.expiresAt).getTime();
      if (!Number.isFinite(end)) continue;
      if (end - nowMs > EXPIRING_SOON_MS || end <= nowMs) continue;
      push({
        key: `expiring-${d.id}`,
        text: ko.activityExpiringSoon,
        sub: d.title,
        to: demandHref(d),
      });
    }

    return items.slice(0, 5);
  }, [activities, getDemand, myDemands]);

  const openDemands = myDemands.filter((d) => {
    const s = effectiveDemandStatus(d);
    return s === "ACTIVE" || s === "MATCHED";
  });
  const archivedDemands = myDemands.filter((d) => {
    const s = effectiveDemandStatus(d);
    return s === "EXPIRED" || s === "CLOSED";
  });

  const pendingMatches = useMemo(
    () => myMatches.filter((m) => m.status !== "CONNECTED"),
    [myMatches],
  );

  const responseRows = useMemo(() => {
    return [...myResponses]
      .filter((r) => r.status !== "WITHDRAWN")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [myResponses]);

  const connectedMatchByDemand = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of myMatches) {
      if (m.status !== "CONNECTED") continue;
      map.set(m.demandId, m.id);
    }
    return map;
  }, [myMatches]);

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
        <h1 className="page-title">{ko.myDan}</h1>
        <Link to={`/profile/${currentUser?.id}`} className="my-dan__name">
          {currentUser?.name}
        </Link>
      </header>

      {nowItems.length > 0 ? (
        <MyBlock title={ko.attentionTitle}>
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
        </MyBlock>
      ) : null}

      {pendingMatches.length > 0 ? (
        <MyBlock title={ko.pendingMatches}>
          <MatchList matches={pendingMatches} emptyWhenZero={false} />
        </MyBlock>
      ) : null}

      <MyBlock title={ko.myRequests}>
        {openDemands.length === 0 ? (
          <div className="my-block__empty">
            <p>{ko.emptyMyRequests}</p>
            <Button to="/create" size="sm">
              {ko.navCreate}
            </Button>
          </div>
        ) : (
          <div className="app-row-list">
            {openDemands.map((d) => (
              <RowLink
                key={d.id}
                to={demandHref(d)}
                title={d.title}
                meta={requestMeta(d, responseCountByDemand.get(d.id) ?? 0)}
              />
            ))}
          </div>
        )}
      </MyBlock>

      <MyBlock title={ko.myResponses}>
        {responseRows.length === 0 ? (
          <p className="my-block__hint">{ko.emptyMyResponses}</p>
        ) : (
          <div className="app-row-list">
            {responseRows.map((r) => {
              const demand = getDemand(r.demandId);
              const matchId = connectedMatchByDemand.get(r.demandId);
              const to =
                r.status === "ACCEPTED" && matchId
                  ? `/match/${matchId}`
                  : `/demand/item/${r.demandId}`;
              return (
                <RowLink
                  key={r.id}
                  to={to}
                  title={demand?.title || r.message || ko.respondCta}
                  meta={responseStatusMeta(r.status)}
                />
              );
            })}
          </div>
        )}
      </MyBlock>

      <div className="my-secondary">
        <button
          type="button"
          className="my-secondary__row"
          aria-expanded={archivedOpen}
          onClick={() => setArchivedOpen((v) => !v)}
        >
          <span>{ko.archivedRequests}</span>
          <span aria-hidden>{archivedOpen ? "∧" : "›"}</span>
        </button>
        {archivedOpen ? (
          <div className="my-secondary__panel">
            {archivedDemands.length === 0 ? (
              <p className="my-block__hint">{ko.emptyArchived}</p>
            ) : (
              <div className="expired-list">
                {archivedDemands.map((d) => {
                  const onDate = formatExpiredOn(d);
                  const isBuy = d.type === "BUY";
                  const expired = effectiveDemandStatus(d) === "EXPIRED";
                  return (
                    <article key={d.id} className="expired-card">
                      <Link to={demandHref(d)} className="expired-card__title">
                        {d.title}
                      </Link>
                      <p className="expired-card__meta">
                        {expired
                          ? isBuy
                            ? `${ko.expiredOnPrefix}${onDate ? ` · ${onDate}` : ""}`
                            : ko.expiredTimedBody
                          : ko.statusClosed}
                      </p>
                      {expired && isBuy ? (
                        <>
                          <p className="expired-card__ask">{ko.expiredBuyAsk}</p>
                          <div className="expired-card__actions">
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => void extendBuyDemand(d.id)}
                            >
                              {ko.extend30d}
                            </Button>
                          </div>
                        </>
                      ) : null}
                      {expired && !isBuy ? (
                        <div className="expired-card__actions">
                          <Button size="sm" to={`/create?type=${d.type}`}>
                            {ko.recreateSimilar}
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        <Link to={`/profile/${currentUser?.id}`} className="my-secondary__row">
          <span>{ko.profileTitle}</span>
          <span aria-hidden>›</span>
        </Link>
      </div>

      {dataMode === "demo" ? (
        <Button variant="ghost" onClick={resetDemo}>
          {ko.resetDemo}
        </Button>
      ) : null}
    </div>
  );
}
