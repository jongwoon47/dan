import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ActivityEvent } from "@/domain/types";
import { getDataMode } from "@/data/mode";
import "./pages.css";

function labelFor(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "NEW_RESPONSE":
      return ko.activityNewResponse;
    case "RESPONSE_ACCEPTED":
      return ko.activityAccepted;
    case "RESPONSE_DECLINED":
      return ko.activityDeclined;
    case "BUYER_INTEREST":
      return ko.activityInterest;
    case "MATCH_CONNECTED":
      return ko.activityConnected;
    case "NEW_MESSAGE":
      return ko.activityMessage;
    case "DEMAND_CLOSED":
      return ko.activityClosed;
    default:
      return kind;
  }
}

function hrefFor(ev: ActivityEvent) {
  if (ev.kind === "NEW_MESSAGE" || ev.kind === "MATCH_CONNECTED") {
    if (ev.matchId) return `/match/${ev.matchId}`;
  }
  if (ev.kind === "BUYER_INTEREST" && ev.matchId) return `/my`;
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
  } = useDan();
  const dataMode = getDataMode();

  useEffect(() => {
    if (isLoggedIn) void refreshActivities();
  }, [isLoggedIn, refreshActivities]);

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
        <h1 className="page-title">{ko.activityTitle}</h1>
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
          {activities.map((ev) => (
            <li key={ev.id} className={ev.readAt ? undefined : "is-unread"}>
              <Link
                to={hrefFor(ev)}
                onClick={() => void markActivityRead(ev.id)}
              >
                <strong>{labelFor(ev.kind)}</strong>
                <span>
                  {new Date(ev.createdAt).toLocaleString("ko-KR", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
