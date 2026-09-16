import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ActivityEvent, Demand } from "@/domain/types";
import { getDataMode } from "@/data/mode";
import { formatRelativeTime, formatWon } from "@/lib/format";
import "./pages.css";

function kindVerb(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "NEW_RESPONSE":
      return "응답했어요";
    case "RESPONSE_ACCEPTED":
      return "응답을 수락했어요";
    case "RESPONSE_DECLINED":
      return "응답이 거절됐어요";
    case "BUYER_INTEREST":
      return "구매 관심을 표시했어요";
    case "MATCH_CONNECTED":
      return "연결됐어요";
    case "MATCH_COMPLETED":
      return ko.activityMatchCompleted;
    case "MATCH_TRADE_CLOSED":
      return ko.activityMatchTradeClosed;
    case "NEW_MESSAGE":
      return "메시지를 보냈어요";
    case "DEMAND_CLOSED":
      return "글이 마감됐어요";
    default:
      return "알림이 있어요";
  }
}

function hrefFor(ev: ActivityEvent, demand?: Demand) {
  if (
    ev.kind === "NEW_MESSAGE" ||
    ev.kind === "MATCH_CONNECTED" ||
    ev.kind === "MATCH_COMPLETED" ||
    ev.kind === "MATCH_TRADE_CLOSED"
  ) {
    if (ev.matchId) return `/match/${ev.matchId}`;
  }
  if (ev.kind === "BUYER_INTEREST" && demand?.type === "BUY") {
    return `/demand/${demand.details.productId}`;
  }
  if (ev.demandId) return `/demand/item/${ev.demandId}`;
  return "/my";
}

export function ActivityPage() {
  const {
    isLoggedIn,
    login,
    activities,
    refreshActivities,
    markActivityRead,
    unreadActivityCount,
    getDemand,
    state,
    getPublicProfile,
  } = useDan();
  const dataMode = getDataMode();
  const [names, setNames] = useState<Record<string, string>>({});

  useDeepHeader({
    title: ko.activityTitle,
  });

  useEffect(() => {
    if (isLoggedIn) void refreshActivities();
  }, [isLoggedIn, refreshActivities]);

  const actorKey = useMemo(
    () =>
      activities
        .map((a) => a.actorId)
        .filter(Boolean)
        .join(","),
    [activities],
  );

  useEffect(() => {
    if (!actorKey) return;
    const ids = [...new Set(actorKey.split(",").filter(Boolean))];
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        ids.map(async (id) => {
          const p = await getPublicProfile(id);
          next[id] = p?.displayName ?? "누군가";
        }),
      );
      if (!cancelled) setNames((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [actorKey, getPublicProfile]);

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
    <div className="page-stack page-narrow">
      {unreadActivityCount > 0 ? (
        <div className="section-toolbar">
          <button
            type="button"
            className="text-link text-link--muted"
            onClick={() => void markActivityRead()}
          >
            {ko.markAllRead}
          </button>
        </div>
      ) : null}
      {activities.length === 0 ? (
        <EmptyState title={ko.activityEmpty} />
      ) : (
        <ul className="activity-list">
          {activities.map((ev) => {
            const demand = ev.demandId ? getDemand(ev.demandId) : undefined;
            const response = ev.responseId
              ? state.responses.find((r) => r.id === ev.responseId)
              : undefined;
            const actor = ev.actorId ? names[ev.actorId] : undefined;
            const withActor =
              Boolean(actor) &&
              (ev.kind === "NEW_RESPONSE" ||
                ev.kind === "MATCH_CONNECTED" ||
                ev.kind === "MATCH_COMPLETED" ||
                ev.kind === "MATCH_TRADE_CLOSED" ||
                ev.kind === "BUYER_INTEREST" ||
                ev.kind === "NEW_MESSAGE" ||
                ev.kind === "RESPONSE_ACCEPTED");
            const title = withActor
              ? `${actor}님이 ${kindVerb(ev.kind)}`
              : kindVerb(ev.kind);
            const bits = [
              demand?.title,
              response?.offeredPrice != null && response.offeredPrice > 0
                ? formatWon(response.offeredPrice)
                : demand?.type === "BUY" && demand.budget > 0
                  ? formatWon(demand.budget)
                  : null,
              response?.availabilityText,
            ].filter(Boolean);
            const initial = (actor ?? "·").slice(0, 1);

            return (
              <li key={ev.id} className={ev.readAt ? undefined : "is-unread"}>
                <Link
                  to={hrefFor(ev, demand)}
                  onClick={() => void markActivityRead(ev.id)}
                >
                  <span className="activity-list__avatar" aria-hidden>
                    {actor ? initial : "●"}
                  </span>
                  <span className="activity-list__main">
                    <strong>{title}</strong>
                    {bits.length ? (
                      <span className="activity-list__meta">
                        {bits.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="activity-list__time">
                    {!ev.readAt ? (
                      <span className="activity-list__dot" aria-label="안 읽음" />
                    ) : null}
                    {formatRelativeTime(ev.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
