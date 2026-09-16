import { navigateBack } from "@/lib/navBack";
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
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ChatMessage, Demand, Match } from "@/domain/types";
import "./pages.css";

const POLL_MS = 8000;
const CHAT_STATUSES = new Set(["CONNECTED", "COMPLETED", "CLOSED"]);

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

function tradeConfirmBody(demand?: Demand) {
  if (!demand) return ko.tradeConfirmTitle;
  switch (demand.type) {
    case "BUY":
      return ko.tradeConfirmBuy;
    case "BORROW":
      return ko.tradeConfirmBorrow;
    case "TASK":
      return ko.tradeConfirmTask;
    case "SERVICE":
      return ko.tradeConfirmService;
    default:
      return ko.tradeConfirmTitle;
  }
}

function formatCompletedDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function iConfirmed(match: Match, userId: string) {
  return userId === match.buyerId
    ? Boolean(match.buyerCompletedAt)
    : Boolean(match.sellerCompletedAt);
}

function peerConfirmed(match: Match, userId: string) {
  return userId === match.buyerId
    ? Boolean(match.sellerCompletedAt)
    : Boolean(match.buyerCompletedAt);
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
    confirmMatchCompletion,
    closeMatch,
    reopenDemandAfterTradeClose,
    blockUser,
    reportUser,
    getPublicProfile,
    busy,
  } = useDan();
  const match = myMatches.find((m) => m.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const isDemandOwner =
    Boolean(currentUser && demand && demand.userId === currentUser.id);
  const canReopenDemand =
    match?.status === "CLOSED" &&
    isDemandOwner &&
    demand?.status === "MATCHED";
  const demandAlreadyReopened =
    match?.status === "CLOSED" &&
    isDemandOwner &&
    demand?.status === "ACTIVE";
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
  const onMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
  }, []);
  const [confirm, setConfirm] = useState<
    "block" | "report" | "complete" | "cancel" | "reopen" | null
  >(null);
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
      if (!cancelled) setPeerName(p?.displayName?.trim() ?? "");
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
  }, [messages, loading, match?.status, match?.buyerCompletedAt, match?.sellerCompletedAt]);

  const demandTitle = useMemo(() => demand?.title ?? ko.chatTitle, [demand]);
  const displayPeer = peerName || "상대";
  const canSend =
    match?.status === "CONNECTED" || match?.status === "COMPLETED";

  function goBack() {
    navigateBack(navigate, "/chats");
  }

  if (!match || !CHAT_STATUSES.has(match.status)) {
    return (
      <EmptyState
        title={ko.chatTitle}
        body={ko.genericError}
        action={<Button to="/chats" variant="secondary">{ko.navChats}</Button>}
      />
    );
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (busy || !body.trim() || !canSend) return;
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

  const mineDone = currentUser ? iConfirmed(match, currentUser.id) : false;
  const peerDone = currentUser ? peerConfirmed(match, currentUser.id) : false;

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
          {demand ? (
            <Link
              to={`/demand/item/${demand.id}`}
              className="chat-page__view-demand"
            >
              {ko.viewRequest}
            </Link>
          ) : null}
        </div>
        {peerId ? (
          <OverflowMenu
            open={menuOpen}
            onOpenChange={onMenuOpenChange}
            items={[
              {
                label: ko.block,
                danger: true,
                onSelect: () => setConfirm("block"),
              },
              {
                label: ko.report,
                onSelect: () => setConfirm("report"),
              },
            ]}
          />
        ) : null}
      </header>

      <section className="trade-status" aria-live="polite">
        <p className="trade-status__title">{demandTitle}</p>
        {match.status === "COMPLETED" ? (
          <>
            <p className="trade-status__state">✓ {ko.tradeDoneTitle}</p>
            {match.completedAt ? (
              <p className="trade-status__meta">
                {formatCompletedDate(match.completedAt)}
              </p>
            ) : null}
            <p className="trade-status__hint">{ko.tradeDoneHint}</p>
          </>
        ) : match.status === "CLOSED" ? (
          <>
            <p className="trade-status__state">{ko.tradeClosedTitle}</p>
            {canReopenDemand ? (
              <>
                <p className="trade-status__hint">{ko.tradeClosedSeekHint}</p>
                <div className="trade-status__actions">
                  <Button
                    fullWidth
                    disabled={busy}
                    onClick={() => setConfirm("reopen")}
                  >
                    {ko.tradeReopenCta}
                  </Button>
                </div>
              </>
            ) : demandAlreadyReopened ? (
              <p className="trade-status__hint">{ko.tradeReopenedHint}</p>
            ) : (
              <p className="trade-status__hint">{ko.tradePeerClosed}</p>
            )}
          </>
        ) : peerDone && !mineDone ? (
          <>
            <p className="trade-status__state">{ko.tradePeerConfirmed}</p>
            <p className="trade-status__hint">{ko.tradePeerConfirmedHint}</p>
            <div className="trade-status__actions">
              <Button
                fullWidth
                disabled={busy}
                onClick={() => setConfirm("complete")}
              >
                {ko.tradeConfirmPeerCta}
              </Button>
            </div>
          </>
        ) : mineDone && !peerDone ? (
          <>
            <p className="trade-status__state">{ko.tradeInProgress}</p>
            <p className="trade-status__hint">{ko.tradeWaitingPeer}</p>
          </>
        ) : (
          <>
            <p className="trade-status__state">{ko.tradeInProgress}</p>
            <p className="trade-status__hint">{ko.tradeInProgressHint}</p>
            <div className="trade-status__actions">
              <Button
                fullWidth
                disabled={busy}
                onClick={() => setConfirm("complete")}
              >
                {ko.tradeCompleteCta}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                {ko.tradeCancelCta}
              </Button>
            </div>
          </>
        )}
      </section>

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

      {canSend ? (
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
      ) : (
        <p className="chat-composer chat-composer--closed muted">
          {ko.tradeClosedTitle}
        </p>
      )}

      <ConfirmSheet
        open={confirm === "complete"}
        title={ko.tradeConfirmTitle}
        body={tradeConfirmBody(demand)}
        confirmLabel={ko.tradeConfirmAction}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void confirmMatchCompletion(matchId).then((updated) => {
            setConfirm(null);
            if (!updated) setError(ko.genericError);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "cancel"}
        title={ko.tradeCancelTitle}
        body={ko.tradeCancelBody}
        confirmLabel={ko.tradeCancelAction}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void closeMatch(matchId).then((updated) => {
            setConfirm(null);
            if (!updated) setError(ko.genericError);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "reopen"}
        title={ko.tradeClosedSeekHint}
        body={ko.tradeReopenBody}
        confirmLabel={ko.tradeReopenCta}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void reopenDemandAfterTradeClose(matchId).then((updated) => {
            setConfirm(null);
            if (!updated) {
              setError(ko.genericError);
              return;
            }
            setToast(ko.tradeReopenedToast);
          });
        }}
      />

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
