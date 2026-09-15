import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import { dedupeConnectedMatches } from "@/domain/matchLifecycle";
import type { ChatMessage, Match } from "@/domain/types";
import "./pages.css";

function formatRelativeChatTime(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, nowMs - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "어제";
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function initialOf(name: string) {
  return (name.trim().slice(0, 1) || "?").toUpperCase();
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
            peerName: profile?.displayName?.trim() || "상대",
            demandTitle: demand?.title?.trim() || ko.chatTitle,
            lastMessage: last?.body?.trim() || ko.chatsStartHint,
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
  ]);

  if (!isLoggedIn) {
    return (
      <EmptyState
        title={ko.chatsTitle}
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
    <div className="page-stack page-narrow chats-page">
      <header>
        <h1 className="page-title">{ko.chatsTitle}</h1>
      </header>

      {loading ? (
        <p className="muted">{ko.loading}</p>
      ) : previews.length === 0 ? (
        <EmptyState
          title={ko.chatsEmpty}
          body={ko.chatsEmptyBody}
          action={
            <Button to="/feed" variant="secondary">
              {ko.navFeed}
            </Button>
          }
        />
      ) : (
        <div className="chat-list">
          {previews.map((row) => (
            <Link
              key={row.match.id}
              to={`/match/${row.match.id}`}
              className="chat-list__row"
            >
              <span className="avatar-initial" aria-hidden>
                {initialOf(row.peerName)}
              </span>
              <span className="chat-list__body">
                <span className="chat-list__top">
                  <strong className="chat-list__name">{row.peerName}</strong>
                  {row.lastAt ? (
                    <time dateTime={row.lastAt} className="chat-list__time">
                      {formatRelativeChatTime(row.lastAt)}
                    </time>
                  ) : null}
                </span>
                <span className="chat-list__demand">{row.demandTitle}</span>
                <span className="chat-list__preview">{row.lastMessage}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
