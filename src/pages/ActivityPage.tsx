import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ActivityEvent, Demand } from "@/domain/types";
import { getDataMode } from "@/data/mode";
import { formatWon } from "@/lib/format";
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
    case "NEW_MESSAGE":
      return "메시지를 보냈어요";
    case "DEMAND_CLOSED":
      return "요청이 마감됐어요";
    default:
      return kind;
  }
}

function hrefFor(ev: ActivityEvent, demand?: Demand) {
  if (ev.kind === "NEW_MESSAGE" || ev.kind === "MATCH_CONNECTED") {
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
      <header className="page-header page-header--row">
        <div>
          <h1 className="page-title">{ko.activityTitle}</h1>
        </div>
        {unreadActivityCount > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void markActivityRead()}
          >
            {ko.markAllRead}
          </Button>
        ) : null}
      </header>

      {activities.length === 0 ? (
        <p className="section-desc">{ko.activityEmpty}</p>
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
                ev.kind === "BUYER_INTEREST" ||
                ev.kind === "NEW_MESSAGE" ||
                ev.kind === "RESPONSE_ACCEPTED");
            const title = withActor
              ? `${actor}님이 ${kindVerb(ev.kind)}`
              : kindVerb(ev.kind);
            const bits = [
              demand?.title,
              response?.offeredPrice != null
                ? formatWon(response.offeredPrice)
                : demand?.type === "BUY"
                  ? formatWon(demand.budget)
                  : null,
              response?.availabilityText,
            ].filter(Boolean);

            return (
              <li key={ev.id} className={ev.readAt ? undefined : "is-unread"}>
                <Link
                  to={hrefFor(ev, demand)}
                  onClick={() => void markActivityRead(ev.id)}
                >
                  <span className="activity-list__avatar" aria-hidden>
                    {(actor ?? "알").slice(0, 1)}
                  </span>
                  <span className="activity-list__main">
                    <strong>{title}</strong>
                    {bits.length ? (
                      <span className="activity-list__meta">{bits.join(" · ")}</span>
                    ) : null}
                  </span>
                  <span className="activity-list__time">
                    {new Date(ev.createdAt).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
