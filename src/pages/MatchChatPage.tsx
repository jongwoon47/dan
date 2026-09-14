import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ChatMessage } from "@/domain/types";
import "./pages.css";

const POLL_MS = 8000;

export function MatchChatPage() {
  const { matchId = "" } = useParams();
  const {
    myMatches,
    getDemand,
    currentUser,
    listMessages,
    sendMessage,
    markMessagesRead,
    blockUser,
    reportUser,
    busy,
  } = useDan();
  const match = myMatches.find((m) => m.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const peerId =
    match && currentUser
      ? match.buyerId === currentUser.id
        ? match.sellerId
        : match.buyerId
      : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const rows = await listMessages(matchId);
      setMessages(rows);
      await markMessagesRead(matchId);
      setError(null);
    } catch {
      setError(ko.genericError);
    } finally {
      setLoading(false);
    }
  }, [listMessages, markMessagesRead, matchId]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [load]);

  const title = useMemo(() => demand?.title ?? ko.chatTitle, [demand]);

  if (!match || match.status !== "CONNECTED") {
    return (
      <EmptyState
        title={ko.chatTitle}
        body={ko.genericError}
        action={<Button to="/my" variant="secondary">{ko.navMy}</Button>}
      />
    );
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (busy || !body.trim()) return;
    const text = body.trim();
    setBody("");
    const result = await sendMessage(matchId, text);
    if (!result) {
      setError(ko.genericError);
      setBody(text);
      return;
    }
    await load();
  }

  return (
    <div className="chat-page">
      <header className="chat-page__header">
        <div>
          <h1 className="page-title">{ko.chatTitle}</h1>
          <p className="section-desc">
            {peerId ? (
              <Link to={`/profile/${peerId}`} className="text-link">
                {ko.profileTitle}
              </Link>
            ) : null}
            {" · "}
            {title}
          </p>
        </div>
        {peerId ? (
          <div className="action-row">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!window.confirm(ko.blockConfirm)) return;
                void blockUser(peerId);
              }}
            >
              {ko.block}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const reason = window.prompt(
                  `${ko.reportReason} (spam/fraud/abuse/other)`,
                  "other",
                );
                if (!reason) return;
                void reportUser({
                  targetUserId: peerId,
                  reason: (["spam", "fraud", "abuse", "other"].includes(reason)
                    ? reason
                    : "other") as "spam" | "fraud" | "abuse" | "other",
                }).then(() => window.alert(ko.reportSent));
              }}
            >
              {ko.report}
            </Button>
          </div>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="chat-thread" aria-live="polite">
        {loading ? <p className="muted">{ko.saving}</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="section-desc">{ko.chatEmpty}</p>
        ) : null}
        {messages.map((m) => {
          const mine = m.senderId === currentUser?.id;
          return (
            <div
              key={m.id}
              className={mine ? "chat-bubble chat-bubble--mine" : "chat-bubble"}
            >
              <p>{m.body}</p>
              <time dateTime={m.createdAt}>
                {new Date(m.createdAt).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          );
        })}
      </div>

      <form className="chat-composer" onSubmit={(e) => void onSend(e)}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={ko.chatPlaceholder}
          maxLength={2000}
          aria-label={ko.chatPlaceholder}
        />
        <Button type="submit" disabled={busy || !body.trim()}>
          {ko.chatSend}
        </Button>
      </form>
    </div>
  );
}
