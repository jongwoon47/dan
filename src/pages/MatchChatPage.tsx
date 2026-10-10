import { navigateBack } from "@/lib/navBack";
import { realtimeNotice } from "@/lib/realtimeStatus";
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
import { ProductVisual } from "@/components/ProductVisual";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { fillCopyTemplate } from "@/copy/dealChain";
import { useDanCopy, type LocalizedCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import type { ChatMessage, DealSnapshot, Demand, Match } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import "./pages.css";

const POLL_MS = 60_000;
const CHAT_STATUSES = new Set(["CONNECTED", "COMPLETED", "CLOSED"]);

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, language: "ko" | "ja" = "ko") {
  return new Date(iso).toLocaleDateString(language === "ja" ? "ja-JP" : "ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function tradeConfirmBody(demand: Demand | undefined, copy: LocalizedCopy) {
  if (!demand) return copy.tradeConfirmTitle;
  switch (demand.type) {
    case "BUY":
      return copy.tradeConfirmBuy;
    case "BORROW":
      return copy.tradeConfirmBorrow;
    case "TASK":
      return copy.tradeConfirmTask;
    case "SERVICE":
      return copy.tradeConfirmService;
    default:
      return copy.tradeConfirmTitle;
  }
}

function formatCompletedDate(iso?: string, language: "ko" | "ja" = "ko") {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(language === "ja" ? "ja-JP" : "ko-KR", {
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
  const locale = useDanLocale();
  const copy = useDanCopy();
  const {
    myMatches,
    getDemand,
    getProduct,
    currentUser,
    listMessages,
    subscribeMessages,
    sendMessage,
    markMessagesRead,
    confirmMatchCompletion,
    closeMatch,
    cancelDeal,
    reopenDemandAfterTradeClose,
    blockUser,
    reportUser,
    getPublicProfile,
    getDealSnapshot,
    busy,
  } = useDan();
  const match = myMatches.find((m) => m.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const chatProduct = match?.productId ? getProduct(match.productId) : undefined;
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
  const [dealSnapshot, setDealSnapshot] = useState<DealSnapshot | null>(null);
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
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState("");
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
      // Do not clear composer/send errors here — the poll/focus reload would
      // wipe a just-shown blocked/send failure before the user (or E2E) reads it.
    } catch {
      setError((prev) => prev ?? copy.genericError);
    } finally {
      setLoading(false);
    }
  }, [copy.genericError, listMessages, markMessagesRead, matchId]);

  useEffect(() => {
    void load();

    const unsubscribe = subscribeMessages(
      matchId,
      (message) => {
        setMessages((prev) => {
          const index = prev.findIndex((item) => item.id === message.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = message;
            return next;
          }
          return [...prev, message].sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt),
          );
        });

        if (message.senderId !== currentUser?.id) {
          if (!stickToBottomRef.current) {
            setNewMessageCount((count) => count + 1);
          }
          void markMessagesRead(matchId);
        }
      },
      (status) => {
        setRealtimeStatus(status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          void load();
        }
      },
    );

    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void load(), POLL_MS);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [
    currentUser?.id,
    load,
    markMessagesRead,
    matchId,
    subscribeMessages,
  ]);

  useEffect(() => {
    if (!matchId || demand?.type !== "BUY") {
      setDealSnapshot(null);
      return;
    }
    let cancelled = false;
    void getDealSnapshot(matchId).then((row) => {
      if (!cancelled) setDealSnapshot(row);
    });
    return () => {
      cancelled = true;
    };
  }, [getDealSnapshot, matchId, demand?.type, match?.dealStage]);

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
    if (stickToBottomRef.current) setNewMessageCount(0);
  }

  useEffect(() => {
    const el = threadRef.current;
    if (!el || loading) return;
    if (!initialScrollDone.current || stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDone.current = true;
      setNewMessageCount(0);
    }
  }, [messages, loading, match?.status, match?.buyerCompletedAt, match?.sellerCompletedAt]);

  const demandTitle = useMemo(() => demand?.title ?? copy.chatTitle, [demand, copy.chatTitle]);
  const displayPeer = peerName || copy.chatPeerFallback;
  const canSend = match?.status === "CONNECTED";
  const timeLocale = locale === "ja" ? "ja-JP" : "ko-KR";

  function goBack() {
    navigateBack(navigate, "/chats");
  }

  if (!match || !CHAT_STATUSES.has(match.status)) {
    return (
      <EmptyState
        title={copy.chatTitle}
        body={copy.genericError}
        action={<Button to="/chats" variant="secondary">{copy.navChats}</Button>}
      />
    );
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (busy || !body.trim() || !canSend) return;
    const text = body.trim();
    setBody("");
    stickToBottomRef.current = true;
    try {
      const result = await sendMessage(matchId, text);
      if (!result) {
        setError(copy.genericError);
        setBody(text);
        return;
      }
      setMessages((prev) =>
        prev.some((message) => message.id === result.id)
          ? prev
          : [...prev, result],
      );
      setError(null);
      void load();
    } catch (err) {
      setError(
        err instanceof Error && err.message === "DAN_CHAT_BLOCKED"
          ? copy.chatBlockedSend
          : copy.genericError,
      );
      setBody(text);
    }
  }

  const mineDone = currentUser ? iConfirmed(match, currentUser.id) : false;
  const peerDone = currentUser ? peerConfirmed(match, currentUser.id) : false;
  const isBuyTrade = demand?.type === "BUY";
  const isSeller = Boolean(currentUser && match.sellerId === currentUser.id);
  const buyEvidenceReady = [
    "EVIDENCE_READY",
    "DEAL_REVIEW",
    "DEAL_LOCKED",
    "PAYMENT_PENDING",
    "PAID",
    "HANDOFF_READY",
    "COMPLETED",
  ].includes(match.dealStage ?? "");
  const buySnapshotLocked = Boolean(dealSnapshot?.lockedAt);
  const buyPaid = match.paymentStatus === "PAID";
  const buyComplete = match.status === "COMPLETED";

  let lastDay = "";

  return (
    <div className="chat-page page-narrow">
      <header className="chat-page__header">
        <button
          type="button"
          className="chat-page__back"
          aria-label={copy.chatBackAria}
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
          {realtimeNotice(realtimeStatus) === "live" ? (
            <span className="chat-realtime-status">
              <i aria-hidden /> {copy.chatRealtimeLive}
            </span>
          ) : null}
          {realtimeNotice(realtimeStatus) === "recovering" ? (
            <span className="chat-realtime-status" role="status">
              {copy.chatRealtimeRecovering}
            </span>
          ) : null}
          {demand ? (
            <Link
              to={`/demand/item/${demand.id}`}
              className="chat-page__view-demand"
            >
              {copy.viewRequest}
            </Link>
          ) : null}
        </div>
        {peerId ? (
          <OverflowMenu
            open={menuOpen}
            onOpenChange={onMenuOpenChange}
            label={copy.moreActions}
            items={[
              {
                label: copy.block,
                danger: true,
                onSelect: () => setConfirm("block"),
              },
              {
                label: copy.report,
                onSelect: () => setConfirm("report"),
              },
            ]}
          />
        ) : null}
      </header>

      {isBuyTrade && match.status !== "CLOSED" ? (
        <div className="chat-deal-progress" aria-label={copy.chatDealProgressAria}>
          <span className={buyEvidenceReady ? "is-done" : "is-current"}>
            <i aria-hidden>{buyEvidenceReady ? "✓" : "1"}</i>
            <b>{copy.chatStepProduct}</b>
          </span>
          <em aria-hidden />
          <span className={buySnapshotLocked ? "is-done" : buyEvidenceReady ? "is-current" : ""}>
            <i aria-hidden>{buySnapshotLocked ? "✓" : "2"}</i>
            <b>{copy.chatStepTerms}</b>
          </span>
          <em aria-hidden />
          <span className={buyPaid ? "is-done" : buySnapshotLocked ? "is-current" : ""}>
            <i aria-hidden>{buyPaid ? "✓" : "3"}</i>
            <b>{copy.chatStepPay}</b>
          </span>
          <em aria-hidden />
          <span className={buyComplete ? "is-done" : buyPaid ? "is-current" : ""}>
            <i aria-hidden>{buyComplete ? "✓" : "4"}</i>
            <b>{copy.chatStepHandoff}</b>
          </span>
        </div>
      ) : null}

      <section className="trade-status" aria-live="polite">
        {isBuyTrade && chatProduct ? (
          <div className="trade-status__product">
            <ProductVisual product={chatProduct} size="sm" />
            <div>
              <span>{chatProduct.brand || "DAN"}</span>
              <strong>{demandTitle}</strong>
            </div>
          </div>
        ) : (
          <p className="trade-status__title">{demandTitle}</p>
        )}
        {match.status === "COMPLETED" ? (
          <>
            <p className="trade-status__state">✓ {copy.tradeDoneTitle}</p>
            {match.completedAt ? (
              <p className="trade-status__meta">
                {formatCompletedDate(match.completedAt, locale)}
              </p>
            ) : null}
            <p className="trade-status__hint">{copy.tradeDoneHint}</p>
          </>
        ) : match.status === "CLOSED" ? (
          <>
            <p className="trade-status__state">{copy.tradeClosedTitle}</p>
            {canReopenDemand ? (
              <>
                <p className="trade-status__hint">{copy.tradeClosedSeekHint}</p>
                <div className="trade-status__actions">
                  <Button
                    fullWidth
                    disabled={busy}
                    onClick={() => setConfirm("reopen")}
                  >
                    {copy.tradeReopenCta}
                  </Button>
                </div>
              </>
            ) : demandAlreadyReopened ? (
              <p className="trade-status__hint">{copy.tradeReopenedHint}</p>
            ) : (
              <p className="trade-status__hint">{copy.tradePeerClosed}</p>
            )}
          </>
        ) : isBuyTrade && !buyEvidenceReady ? (
          <>
            <p className="trade-status__state">{copy.chatBuyConnectedState}</p>
            <p className="trade-status__hint">{copy.chatBuyConnectedHint}</p>
            <div className="trade-status__actions">
              {isSeller ? (
                <Button to={`/deal/${match.id}/evidence`} fullWidth>
                  {copy.chatRegisterEvidence}
                </Button>
              ) : (
                <Button to={`/offer/${match.id}`} fullWidth variant="secondary">
                  {copy.chatReviewOffer}
                </Button>
              )}
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                {copy.chatCancelDeal}
              </Button>
            </div>
          </>
        ) : isBuyTrade && !buySnapshotLocked ? (
          <>
            <p className="trade-status__state">{copy.chatEvidenceReadyState}</p>
            <p className="trade-status__hint">{copy.chatEvidenceReadyHint}</p>
            <div className="trade-status__actions">
              <Button to={`/deal/${match.id}/snapshot`} fullWidth>
                {copy.chatConfirmTerms}
              </Button>
              <Button to={`/deal/${match.id}/evidence`} fullWidth variant="secondary">
                {copy.chatViewEvidence}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                {copy.chatCancelDeal}
              </Button>
            </div>
          </>
        ) : isBuyTrade && !buyPaid ? (
          <>
            <p className="trade-status__state">{copy.chatPayTurnState}</p>
            <p className="trade-status__hint">{copy.chatPayTurnHint}</p>
            <div className="trade-status__actions">
              <Button to={`/deal/${match.id}/payment`} fullWidth>
                {copy.chatPayNow}
              </Button>
              <Button to={`/deal/${match.id}/snapshot`} fullWidth variant="secondary">
                {copy.chatViewLockedTerms}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                {copy.chatCancelDeal}
              </Button>
            </div>
          </>
        ) : isBuyTrade && buyPaid ? (
          <>
            <p className="trade-status__state">{copy.chatHandoffState}</p>
            <p className="trade-status__hint">{copy.chatHandoffHint}</p>
            <div className="trade-status__actions">
              <Button to={`/deal/${match.id}/handoff`} fullWidth>
                {copy.chatHandoffConfirm}
              </Button>
            </div>
          </>
        ) : peerDone && !mineDone ? (
          <>
            <p className="trade-status__state">{copy.tradePeerConfirmed}</p>
            <p className="trade-status__hint">{copy.tradePeerConfirmedHint}</p>
            <div className="trade-status__actions">
              <Button
                fullWidth
                disabled={busy}
                onClick={() => setConfirm("complete")}
              >
                {copy.tradeConfirmPeerCta}
              </Button>
            </div>
          </>
        ) : mineDone && !peerDone ? (
          <>
            <p className="trade-status__state">{copy.tradeInProgress}</p>
            <p className="trade-status__hint">{copy.tradeWaitingPeer}</p>
          </>
        ) : (
          <>
            <p className="trade-status__state">{copy.tradeInProgress}</p>
            <p className="trade-status__hint">{copy.tradeInProgressHint}</p>
            <div className="trade-status__actions">
              <Button
                fullWidth
                disabled={busy}
                onClick={() => setConfirm("complete")}
              >
                {copy.tradeCompleteCta}
              </Button>
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                {copy.tradeCancelCta}
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
        {loading ? <p className="muted">{copy.loadingChat}</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="section-desc">{copy.chatEmpty}</p>
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
                  <span>{dayLabel(m.createdAt, locale)}</span>
                </div>
              ) : null}
              <div
                className={mine ? "chat-bubble chat-bubble--mine" : "chat-bubble"}
              >
                <p>{m.body}</p>
                <div className="chat-bubble__meta">
                  <time dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleTimeString(timeLocale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {mine ? (
                    <span>{m.readAt ? copy.chatMsgRead : copy.chatMsgSent}</span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {newMessageCount > 0 ? (
        <button
          type="button"
          className="chat-new-message"
          onClick={() => {
            const el = threadRef.current;
            if (el) el.scrollTop = el.scrollHeight;
            stickToBottomRef.current = true;
            setNewMessageCount(0);
          }}
        >
          {fillCopyTemplate(copy.chatNewMessages, { n: newMessageCount })}
        </button>
      ) : null}

      {canSend ? (
        <form className="chat-composer" onSubmit={(e) => void onSend(e)}>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={copy.chatPlaceholder}
            maxLength={2000}
            aria-label={copy.chatPlaceholder}
          />
          <Button type="submit" disabled={busy || !body.trim()}>
            {copy.chatSend}
          </Button>
        </form>
      ) : (
        <p className="chat-composer chat-composer--closed muted">
          {match.status === "COMPLETED"
            ? copy.chatReadonlyCompleted
            : copy.chatReadonlyClosed}
        </p>
      )}

      <ConfirmSheet
        open={confirm === "complete"}
        title={copy.tradeConfirmTitle}
        body={tradeConfirmBody(demand, copy)}
        confirmLabel={copy.tradeConfirmAction}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void confirmMatchCompletion(matchId).then((updated) => {
            if (!updated) {
              setError(copy.genericError);
              return;
            }
            setConfirm(null);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "cancel"}
        title={copy.tradeCancelTitle}
        body={copy.tradeCancelBody}
        confirmLabel={copy.tradeCancelAction}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action =
            demand?.type === "BUY"
              ? cancelDeal({
                  matchId,
                  reason:
                    currentUser?.id === match.buyerId
                      ? "BUYER_CHANGED_MIND"
                      : "SELLER_CHANGED_MIND",
                })
              : closeMatch(matchId);
          void action.then((updated) => {
            if (!updated) {
              setError(copy.genericError);
              return;
            }
            setConfirm(null);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "reopen"}
        title={copy.tradeClosedSeekHint}
        body={copy.tradeReopenBody}
        confirmLabel={copy.tradeReopenCta}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void reopenDemandAfterTradeClose(matchId).then((updated) => {
            setConfirm(null);
            if (!updated) {
              setError(copy.genericError);
              return;
            }
            setToast(copy.tradeReopenedToast);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "block"}
        title={copy.block}
        body={copy.blockConfirm}
        confirmLabel={copy.block}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!peerId) return;
          void blockUser(peerId).then((ok) => {
            setConfirm(null);
            if (ok) setToast(copy.blockedOk);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "report"}
        title={copy.report}
        body={copy.reportReason}
        confirmLabel={copy.reportSubmit}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!peerId) return;
          void reportUser({
            targetUserId: peerId,
            reason: reportReason,
          }).then((ok) => {
            setConfirm(null);
            if (ok) setToast(copy.reportSent);
          });
        }}
      >
        <div className="confirm-sheet__choices">
          {(
            [
              ["spam", copy.reportSpam],
              ["fraud", copy.reportFraud],
              ["abuse", copy.reportAbuse],
              ["other", copy.reportOther],
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
