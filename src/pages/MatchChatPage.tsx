import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ChatMessage } from "@/domain/types";
import "./pages.css";

const POLL_MS = 8000;

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function MatchChatPage() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();
  const {
    myMatches,
    getDemand,
    currentUser,
    listMessages,
    sendMessage,
    markMessagesRead,
    blockUser,
    reportUser,
    getPublicProfile,
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
  const [peerName, setPeerName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<"block" | "report" | null>(null);
  const [reportReason, setReportReason] = useState<
    "spam" | "fraud" | "abuse" | "other"
  >("spam");
  const [toast, setToast] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const initialScrollDone = useRef(false);

  useDeepHeader({ hide: true });

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

  useEffect(() => {
    if (!peerId) return;
    let cancelled = false;
    void getPublicProfile(peerId).then((p) => {
      if (!cancelled) setPeerName(p?.displayName ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [getPublicProfile, peerId]);

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 80;
  }

  useEffect(() => {
    const el = threadRef.current;
    if (!el || loading) return;
    if (!initialScrollDone.current || stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDone.current = true;
    }
  }, [messages, loading]);

  const demandTitle = useMemo(() => demand?.title ?? ko.chatTitle, [demand]);
  const displayPeer = peerName || "상대";

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/my");
  }

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
    stickToBottomRef.current = true;
    const result = await sendMessage(matchId, text);
    if (!result) {
      setError(ko.genericError);
      setBody(text);
      return;
    }
    await load();
  }

  let lastDay = "";

  return (
    <div className="chat-page page-narrow">
      <header className="chat-page__header">
        <button
          type="button"
          className="chat-page__back"
          aria-label="뒤로가기"
          onClick={goBack}
        >
          ←
        </button>
        <span className="avatar-initial avatar-initial--sm" aria-hidden>
          {displayPeer.slice(0, 1)}
        </span>
        <div className="chat-page__identity">
          <h1 className="chat-page__name">
            {peerId ? (
              <Link to={`/profile/${peerId}`}>{displayPeer}</Link>
            ) : (
              displayPeer
            )}
          </h1>
          <p className="chat-page__demand">{demandTitle}</p>
        </div>
        {peerId ? (
          <div className="chat-menu">
            <button
              type="button"
              className="chat-menu__trigger"
              aria-label={ko.moreActions}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div className="chat-menu__panel" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirm("block");
                  }}
                >
                  {ko.block}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirm("report");
                  }}
                >
                  {ko.report}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {toast ? <p className="section-desc">{toast}</p> : null}

      <div
        className="chat-thread"
        ref={threadRef}
        aria-live="polite"
        onScroll={onThreadScroll}
      >
        {loading ? <p className="muted">{ko.loadingChat}</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="section-desc">{ko.chatEmpty}</p>
        ) : null}
        {messages.map((m) => {
          const mine = m.senderId === currentUser?.id;
          const key = dayKey(m.createdAt);
          const showSep = key !== lastDay;
          lastDay = key;
          return (
            <div key={m.id} className="chat-thread__item">
              {showSep ? (
                <div className="chat-day-sep">
                  <span>{dayLabel(m.createdAt)}</span>
                </div>
              ) : null}
              <div
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

      <ConfirmSheet
        open={confirm === "block"}
        title={ko.block}
        body={ko.blockConfirm}
        confirmLabel={ko.block}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!peerId) return;
          void blockUser(peerId).then((ok) => {
            setConfirm(null);
            if (ok) setToast(ko.blockedOk);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "report"}
        title={ko.report}
        body={ko.reportReason}
        confirmLabel={ko.reportSubmit}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!peerId) return;
          void reportUser({
            targetUserId: peerId,
            reason: reportReason,
          }).then((ok) => {
            setConfirm(null);
            if (ok) setToast(ko.reportSent);
          });
        }}
      >
        <div className="confirm-sheet__choices">
          {(
            [
              ["spam", ko.reportSpam],
              ["fraud", ko.reportFraud],
              ["abuse", ko.reportAbuse],
              ["other", ko.reportOther],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                reportReason === value
                  ? "confirm-sheet__choice is-selected"
                  : "confirm-sheet__choice"
              }
              onClick={() => setReportReason(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </ConfirmSheet>
    </div>
  );
}
