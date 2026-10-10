import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDanCopy, type LocalizedCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import type { ActivityEvent, Demand } from "@/domain/types";
import { getDataMode } from "@/data/mode";
import { useDanLocale, type DanLocale } from "@/i18n/locale";
import { formatRelativeTime, formatStoredMoney } from "@/lib/format";
import "./pages.css";

function kindVerb(kind: ActivityEvent["kind"], copy: LocalizedCopy) {
  switch (kind) {
    case "NEW_RESPONSE":
      return copy.activityNewResponse;
    case "RESPONSE_ACCEPTED":
      return copy.activityAccepted;
    case "RESPONSE_DECLINED":
      return copy.activityDeclined;
    case "BUYER_INTEREST":
      return copy.activityInterest;
    case "MATCH_CONNECTED":
      return copy.activityConnected;
    case "MATCH_COMPLETED":
      return copy.activityMatchCompleted;
    case "MATCH_TRADE_CLOSED":
      return copy.activityMatchTradeClosed;
    case "NEW_MESSAGE":
      return copy.activityMessage;
    case "DEMAND_CLOSED":
      return copy.activityClosed;
    default:
      return copy.activityTitle;
  }
}

function titleFor(
  ev: ActivityEvent,
  actor: string | undefined,
  copy: LocalizedCopy,
  locale: DanLocale,
) {
  const verb = kindVerb(ev.kind, copy);
  const withActor =
    Boolean(actor) &&
    (ev.kind === "NEW_RESPONSE" ||
      ev.kind === "MATCH_CONNECTED" ||
      ev.kind === "MATCH_COMPLETED" ||
      ev.kind === "MATCH_TRADE_CLOSED" ||
      ev.kind === "BUYER_INTEREST" ||
      ev.kind === "NEW_MESSAGE" ||
      ev.kind === "RESPONSE_ACCEPTED");
  if (!withActor || !actor) return verb;
  return locale === "ja" ? `${actor}さん：${verb}` : `${actor}님이 ${verb}`;
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
  const locale = useDanLocale();
  const copy = useDanCopy();
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
    title: copy.activityTitle,
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
          next[id] = p?.displayName ?? (locale === "ja" ? "だれか" : "누군가");
        }),
      );
      if (!cancelled) setNames((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [actorKey, getPublicProfile, locale]);

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

  return (
    <div className="page-stack page-narrow">
      {unreadActivityCount > 0 ? (
        <div className="section-toolbar">
          <button
            type="button"
            className="text-link text-link--muted"
            onClick={() => void markActivityRead()}
          >
            {copy.markAllRead}
          </button>
        </div>
      ) : null}
      {activities.length === 0 ? (
        <EmptyState
          title={copy.activityEmpty}
          body={
            locale === "ja"
              ? "新しい返答、取引の進行、メッセージのお知らせがここに集まります。"
              : "새 응답, 거래 진행, 메시지 알림이 이곳에 모여요."
          }
          action={
            <Button to="/feed" variant="secondary">
              {copy.ctaBrowse}
            </Button>
          }
        />
      ) : (
        <ul className="activity-list">
          {activities.map((ev) => {
            const demand = ev.demandId ? getDemand(ev.demandId) : undefined;
            const response = ev.responseId
              ? state.responses.find((r) => r.id === ev.responseId)
              : undefined;
            const actor = ev.actorId ? names[ev.actorId] : undefined;
            const title = titleFor(ev, actor, copy, locale);
            const bits = [
              demand?.title,
              response?.offeredPrice != null && response.offeredPrice > 0
                ? formatStoredMoney(response.offeredPrice, demand?.currencyCode ?? "KRW", locale)
                : demand?.type === "BUY" && demand.budget > 0
                  ? formatStoredMoney(demand.budget, demand.currencyCode ?? "KRW", locale)
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
                      <span
                        className="activity-list__dot"
                        aria-label={locale === "ja" ? "未読" : "안 읽음"}
                      />
                    ) : null}
                    {formatRelativeTime(ev.createdAt, locale)}
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
