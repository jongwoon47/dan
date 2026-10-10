import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDanLocale } from "@/i18n/locale";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { dedupeConnectedMatches } from "@/domain/matchLifecycle";
import type { ChatMessage, Match } from "@/domain/types";
import { formatRelativeTime } from "@/lib/format";
import "./pages.css";

function initialOf(name: string) {
  return (name.trim().slice(0, 1) || "?").toUpperCase();
}

function chatStageLabel(match: Match, copy: ReturnType<typeof useDanCopy>): string {
  if (match.status === "CLOSED") return copy.tradeClosedTitle;
  if (match.status === "COMPLETED") return copy.matchStatusCompleted;
  if (match.dealStage === "HANDOFF_READY" || match.paymentStatus === "PAID") {
    return copy.matchStageHandoff;
  }
  if (match.dealStage === "PAYMENT_PENDING" || match.dealStage === "DEAL_LOCKED") {
    return copy.matchStagePaymentNeeded;
  }
  if (match.dealStage === "EVIDENCE_READY" || match.dealStage === "DEAL_REVIEW") {
    return copy.matchStageDealReview;
  }
  return copy.matchStageChatting;
}

type Preview = {
  match: Match;
  peerId: string;
  peerName: string;
  demandTitle: string;
  lastMessage: string;
  lastAt: string | null;
};

export function ConversationsPage() {
  const copy = useDanCopy();
  const locale = useDanLocale();
  const {
    isLoggedIn,
    login,
    currentUser,
    myMatches,
    getDemand,
    getPublicProfile,
    listMessages,
  } = useDan();
  const dataMode = getDataMode();
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [loading, setLoading] = useState(true);

  const connected = useMemo(
    () => dedupeConnectedMatches(myMatches, currentUser?.id ?? null),
    [myMatches, currentUser?.id],
  );

  const connectedKey = useMemo(
    () => connected.map((m) => m.id).join(","),
    [connected],
  );

  useEffect(() => {
    if (!isLoggedIn || !currentUser) {
      setPreviews([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const rows = await Promise.all(
        connected.map(async (match) => {
          const peerId =
            match.buyerId === currentUser.id ? match.sellerId : match.buyerId;
          const [profile, messages] = await Promise.all([
            getPublicProfile(peerId),
            listMessages(match.id).catch(() => [] as ChatMessage[]),
          ]);
          const last = messages[messages.length - 1];
          const demand = getDemand(match.demandId);
          return {
            match,
            peerId,
            peerName: profile?.displayName?.trim() || copy.chatPeerFallback,
            demandTitle: demand?.title?.trim() || copy.chatTitle,
            lastMessage: last?.body?.trim() || copy.chatsStartHint,
            lastAt: last?.createdAt ?? match.createdAt,
          } satisfies Preview;
        }),
      );
      if (cancelled) return;
      rows.sort((a, b) => {
        const at = a.lastAt ? Date.parse(a.lastAt) : 0;
        const bt = b.lastAt ? Date.parse(b.lastAt) : 0;
        return bt - at;
      });
      setPreviews(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    connectedKey,
    currentUser,
    getDemand,
    getPublicProfile,
    isLoggedIn,
    listMessages,
    connected,
    copy,
    locale,
  ]);

  if (!isLoggedIn) {
    return (
      <EmptyState
        title={copy.chatsTitle}
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
    <div className="page-stack page-narrow chats-page">
      <header>
        <h1 className="page-title">{copy.chatsTitle}</h1>
      </header>

      {loading ? (
        <p className="muted discovery-loading" role="status" aria-live="polite" aria-busy="true">
          {copy.loading}
        </p>
      ) : previews.length === 0 ? (
        <EmptyState
          title={copy.chatsEmpty}
          body={copy.chatsEmptyBody}
          action={
            <Button to="/feed" variant="secondary">
              {copy.navFeed}
            </Button>
          }
        />
      ) : (
        <ul className="chat-list" aria-label={copy.chatsTitle}>
          {previews.map((row) => (
            <li key={row.match.id} className="chat-list__item">
              <Link
                to={`/match/${row.match.id}`}
                className="chat-list__row"
                aria-label={`${row.peerName}. ${row.demandTitle}. ${chatStageLabel(row.match, copy)}. ${row.lastMessage}`}
              >
                <span className="avatar-initial" aria-hidden>
                  {initialOf(row.peerName)}
                </span>
                <span className="chat-list__body">
                  <span className="chat-list__top">
                    <strong className="chat-list__name">{row.peerName}</strong>
                    {row.lastAt ? (
                      <time dateTime={row.lastAt} className="chat-list__time">
                        {formatRelativeTime(row.lastAt, locale)}
                      </time>
                    ) : null}
                  </span>
                  <span className="chat-list__demand">
                    <span className="chat-list__title">{row.demandTitle}</span>
                    <em className="chat-list__stage">{chatStageLabel(row.match, copy)}</em>
                  </span>
                  <span className="chat-list__preview">{row.lastMessage}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
