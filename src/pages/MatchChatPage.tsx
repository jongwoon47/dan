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
import { ko } from "@/copy/ko";
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
      setError(null);
    } catch {
      setError(ko.genericError);
    } finally {
      setLoading(false);
    }
  }, [listMessages, markMessagesRead, matchId]);

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

  const demandTitle = useMemo(() => demand?.title ?? ko.chatTitle, [demand]);
  const displayPeer = peerName || "상대";
  const canSend = match?.status === "CONNECTED";

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
    setMessages((prev) =>
      prev.some((message) => message.id === result.id)
        ? prev
        : [...prev, result],
    );
    setError(null);
    void load();
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
          {realtimeNotice(realtimeStatus) === "live" ? (
            <span className="chat-realtime-status">
              <i aria-hidden /> 실시간
            </span>
          ) : null}
          {realtimeNotice(realtimeStatus) === "recovering" ? (
            <span className="chat-realtime-status" role="status">
              실시간 연결이 끊겼어요. 메시지는 자동으로 다시 불러옵니다.
            </span>
          ) : null}
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

      {isBuyTrade && match.status !== "CLOSED" ? (
        <div className="chat-deal-progress" aria-label="거래 진행 단계">
          <span className={buyEvidenceReady ? "is-done" : "is-current"}>
            <i aria-hidden>{buyEvidenceReady ? "✓" : "1"}</i>
            <b>상품</b>
          </span>
          <em aria-hidden />
          <span className={buySnapshotLocked ? "is-done" : buyEvidenceReady ? "is-current" : ""}>
            <i aria-hidden>{buySnapshotLocked ? "✓" : "2"}</i>
            <b>조건</b>
          </span>
          <em aria-hidden />
          <span className={buyPaid ? "is-done" : buySnapshotLocked ? "is-current" : ""}>
            <i aria-hidden>{buyPaid ? "✓" : "3"}</i>
            <b>결제</b>
          </span>
          <em aria-hidden />
          <span className={buyComplete ? "is-done" : buyPaid ? "is-current" : ""}>
            <i aria-hidden>{buyComplete ? "✓" : "4"}</i>
            <b>인계</b>
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
            <p className="trade-status__state">✓ {ko.tradeDoneTitle}</p>
            {match.completedAt ? (
              <p className="trade-status__meta">
                {formatCompletedDate(match.completedAt, locale)}
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
        ) : isBuyTrade && !buyEvidenceReady ? (
          <>
            <p className="trade-status__state">연결됐어요 · 먼저 대화해 보세요</p>
            <p className="trade-status__hint">
              거래를 계속하기로 했다면 판매자가 상품 상태와 확인 정보를 등록해요.
            </p>
            <div className="trade-status__actions">
              {isSeller ? (
                <Button to={`/deal/${match.id}/evidence`} fullWidth>
                  상품 정보 등록
                </Button>
              ) : (
                <Button to={`/offer/${match.id}`} fullWidth variant="secondary">
                  제안 다시 보기
                </Button>
              )}
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                거래 취소
              </Button>
            </div>
          </>
        ) : isBuyTrade && !buySnapshotLocked ? (
          <>
            <p className="trade-status__state">상품 정보가 준비됐어요</p>
            <p className="trade-status__hint">
              상품 상태와 가격을 확인하고 거래 조건을 확정하세요.
            </p>
            <div className="trade-status__actions">
              <Button to={`/deal/${match.id}/snapshot`} fullWidth>
                거래 조건 확인
              </Button>
              <Button to={`/deal/${match.id}/evidence`} fullWidth variant="secondary">
                상품 정보 보기
              </Button>
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                거래 취소
              </Button>
            </div>
          </>
        ) : isBuyTrade && !buyPaid ? (
          <>
            <p className="trade-status__state">결제를 진행할 차례예요</p>
            <p className="trade-status__hint">
              거래 조건은 확정됐어요. 결제가 확인되면 인계 단계로 넘어갑니다.
            </p>
            <div className="trade-status__actions">
              <Button to={`/deal/${match.id}/payment`} fullWidth>
                결제하기
              </Button>
              <Button to={`/deal/${match.id}/snapshot`} fullWidth variant="secondary">
                확정된 거래 조건 보기
              </Button>
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm("cancel")}
              >
                거래 취소
              </Button>
            </div>
          </>
        ) : isBuyTrade && buyPaid ? (
          <>
            <p className="trade-status__state">물품 인계 확인 단계예요</p>
            <p className="trade-status__hint">
              실제 물품과 확정한 거래 조건을 다시 확인한 뒤 인계를 완료하세요.
            </p>
            <div className="trade-status__actions">
              <Button to={`/deal/${match.id}/handoff`} fullWidth>
                인계 확인
              </Button>
            </div>
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
                  <span>{dayLabel(m.createdAt, locale)}</span>
                </div>
              ) : null}
              <div
                className={mine ? "chat-bubble chat-bubble--mine" : "chat-bubble"}
              >
                <p>{m.body}</p>
                <div className="chat-bubble__meta">
                  <time dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {mine ? (
                    <span>{m.readAt ? "읽음" : "전송됨"}</span>
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
          새 메시지 {newMessageCount}개 ↓
        </button>
      ) : null}

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
          {match.status === "COMPLETED"
            ? "거래가 완료되어 채팅이 읽기 전용이에요."
            : "종료된 거래 · 채팅은 읽기 전용이에요."}
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
