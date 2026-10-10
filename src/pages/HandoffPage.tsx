import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { fillCopyTemplate } from "@/copy/dealChain";
import { useDanCopy, type LocalizedCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import type { DealDispute, DealDisputeReason, DealSnapshot } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import { useNavigate, useParams } from "react-router-dom";
import "./pages.css";

function disputeOptions(copy: LocalizedCopy): Array<{ value: DealDisputeReason; label: string }> {
  return [
    { value: "WRONG_ITEM", label: copy.disputeWrongItem },
    { value: "SNAPSHOT_MISMATCH", label: copy.disputeSnapshotMismatch },
    { value: "MAJOR_UNDISCLOSED_DEFECT", label: copy.disputeMajorDefect },
    { value: "ITEM_NOT_RECEIVED", label: copy.disputeNotReceived },
    { value: "OTHER", label: copy.disputeOther },
  ];
}

function snapshotString(
  snapshot: Record<string, unknown>,
  path: string[],
): string {
  let current: unknown = snapshot;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === "string") return current;
  if (typeof current === "number") return String(current);
  if (Array.isArray(current)) return current.filter((x) => typeof x === "string").join(", ");
  return "";
}

export function HandoffPage() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();
  const locale = useDanLocale();
  const copy = useDanCopy();
  const numberLocale = locale === "ja" ? "ja-JP" : "ko-KR";
  const {
    myMatches,
    currentUser,
    getDemand,
    getProduct,
    getDealSnapshot,
    listDealDisputes,
    openDealDispute,
    confirmMatchCompletion,
    refreshData,
    busy,
  } = useDan();

  const match = myMatches.find((m) => m.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [disputes, setDisputes] = useState<DealDispute[]>([]);
  const [reason, setReason] = useState<DealDisputeReason>("SNAPSHOT_MISMATCH");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const options = disputeOptions(copy);

  useDeepHeader({ title: copy.handoffTitle });

  useEffect(() => {
    if (!matchId) return;
    void Promise.all([
      getDealSnapshot(matchId),
      listDealDisputes(matchId),
    ]).then(([nextSnapshot, nextDisputes]) => {
      setSnapshot(nextSnapshot);
      setDisputes(nextDisputes);
    });
  }, [getDealSnapshot, listDealDisputes, matchId, match?.dealStage]);

  // Ops/provider settlement updates payment_status out-of-band; poll so the
  // handoff confirm UI opens without requiring a full app reload.
  useEffect(() => {
    if (!matchId || !match || match.paymentStatus === "PAID") return;
    if (!snapshot?.lockedAt) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void refreshData();
    };
    const id = window.setInterval(tick, 2500);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [match, matchId, refreshData, snapshot?.lockedAt]);

  const openDispute = disputes.find(
    (x) => x.status === "OPEN" || x.status === "REVIEWING",
  );
  const isBuyer = Boolean(match && currentUser?.id === match.buyerId);
  const mineDone = match
    ? isBuyer
      ? Boolean(match.buyerCompletedAt)
      : Boolean(match.sellerCompletedAt)
    : false;
  const peerDone = match
    ? isBuyer
      ? Boolean(match.sellerCompletedAt)
      : Boolean(match.buyerCompletedAt)
    : false;
  const shippingOnly = Boolean(
    demand &&
      demand.fulfillmentOptions.length > 0 &&
      demand.fulfillmentOptions.every((option) => option.mode === "SHIPPING"),
  );
  const handoffLabel = shippingOnly ? copy.handoffShippingLabel : copy.handoffMeetupLabel;

  const facts = useMemo(() => {
    if (!snapshot) return [];
    const payload = snapshot.snapshot;
    const usage = snapshotString(payload, ["evidence", "usageCount"]);
    const rows: string[][] = [
      [
        copy.dealProductLabel,
        snapshotString(payload, ["product", "name"]) || product?.name || "",
      ],
      [
        copy.dealPriceLabel,
        formatStoredMoney(
          snapshot.agreedPrice,
          snapshot.currencyCode ?? demand?.currencyCode ?? "KRW",
          locale,
        ),
      ],
    ];
    if (usage) {
      rows.push([
        product?.category === "camera" ? copy.dealShutterCount : copy.dealUsageCount,
        product?.category === "camera"
          ? fillCopyTemplate(copy.dealShutterCountValue, {
              n: Number(usage).toLocaleString(numberLocale),
            })
          : Number(usage).toLocaleString(numberLocale),
      ]);
    }
    rows.push(
      [
        copy.dealComponents,
        snapshotString(payload, ["evidence", "components"]) || copy.dealNone,
      ],
      [
        copy.dealAppearance,
        snapshotString(payload, ["evidence", "cosmeticNotes"]) || copy.dealNotSubmitted,
      ],
      [
        copy.dealKnownIssues,
        snapshotString(payload, ["evidence", "knownIssues"]) || copy.dealNotSubmitted,
      ],
      [
        copy.dealTradeMethod,
        snapshotString(payload, ["handoff", "method"]) || copy.meetup,
      ],
    );
    return rows;
  }, [
    copy,
    demand?.currencyCode,
    locale,
    numberLocale,
    product?.category,
    product?.name,
    snapshot,
  ]);

  if (!match || !currentUser || !demand || demand.type !== "BUY" || !product) {
    return (
      <EmptyState
        title={copy.dealMissingTitle}
        action={
          <Button to="/my" variant="secondary">
            {copy.dealTradeList}
          </Button>
        }
      />
    );
  }

  if (!snapshot?.lockedAt) {
    return (
      <EmptyState
        title={copy.paymentNeedLockTitle}
        body={copy.handoffNeedLockBody}
        action={
          <Button to={`/deal/${match.id}/snapshot`}>{copy.snapshotConfirmCta}</Button>
        }
      />
    );
  }

  if (match.paymentStatus !== "PAID") {
    return (
      <EmptyState
        title={copy.handoffNeedPayTitle}
        body={copy.handoffNeedPayBody}
        action={<Button to={"/deal/" + match.id + "/payment"}>{copy.dealPayCta}</Button>}
      />
    );
  }

  async function confirmHandoff() {
    setError("");
    const updated = await confirmMatchCompletion(matchId);
    if (!updated) {
      setError(copy.handoffConfirmFail);
      return;
    }
    if (updated.status === "COMPLETED") {
      navigate("/deal/" + matchId + "/complete");
    }
  }

  async function submitDispute() {
    if (!detail.trim() && reason === "OTHER") {
      setError(copy.handoffDisputeOtherRequired);
      return;
    }
    setError("");
    const created = await openDealDispute({
      matchId,
      reason,
      detail: detail.trim(),
    });
    if (!created) {
      setError(copy.handoffDisputeFail);
      return;
    }
    setDisputes((prev) => [created, ...prev]);
  }

  return (
    <div className="page-stack page-narrow handoff-page">
      <section className="handoff-hero">
        <span className="eyebrow">{copy.handoffEyebrow}</span>
        <h1 className="page-title">{product.name}</h1>
        <p>{copy.handoffLead}</p>
      </section>

      <section className="trade-progress-card" aria-label={copy.handoffProgressAria}>
        <div className="trade-progress-row is-done">
          <span className="trade-progress-icon">✓</span>
          <div>
            <strong>{copy.handoffProgressTerms}</strong>
            <small>{copy.handoffProgressTermsDone}</small>
          </div>
        </div>
        <div
          className={
            match.paymentStatus === "PAID"
              ? "trade-progress-row is-done"
              : "trade-progress-row is-current"
          }
        >
          <span className="trade-progress-icon">
            {match.paymentStatus === "PAID" ? "✓" : "2"}
          </span>
          <div>
            <strong>{copy.handoffProgressPay}</strong>
            <small>
              {match.paymentStatus === "PAID" ? copy.handoffPayDone : copy.handoffPayWaiting}
            </small>
          </div>
        </div>
        <div
          className={
            match.status === "COMPLETED"
              ? "trade-progress-row is-done"
              : match.paymentStatus === "PAID"
                ? "trade-progress-row is-current"
                : "trade-progress-row"
          }
        >
          <span className="trade-progress-icon">
            {match.status === "COMPLETED" ? "✓" : "3"}
          </span>
          <div>
            <strong>{handoffLabel}</strong>
            <small>
              {match.status === "COMPLETED"
                ? copy.handoffComplete
                : match.paymentStatus === "PAID"
                  ? copy.handoffCoordinateChat
                  : copy.handoffAfterPay}
            </small>
          </div>
        </div>
      </section>

      <section className="deal-snapshot-card">
        {facts.map(([label, value]) => (
          <div className="snapshot-section" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      {openDispute ? (
        <section className="dispute-paused">
          <strong>{copy.handoffDisputePausedTitle}</strong>
          <p>{copy.handoffDisputePausedBody}</p>
          <span>
            {options.find((x) => x.value === openDispute.reason)?.label ?? openDispute.reason}
          </span>
        </section>
      ) : match.status === "COMPLETED" ? (
        <section className="trade-complete-card">
          <span className="safe-payment-placeholder__icon">✓</span>
          <div>
            <strong>{copy.handoffDoneTitle}</strong>
            <p>{copy.handoffDoneBody}</p>
          </div>
          <Button to={`/profile/${currentUser.id}`} variant="secondary" fullWidth>
            {copy.handoffViewMyTrades}
          </Button>
        </section>
      ) : (
        <>
          <section className="final-confirm-card">
            <strong>{isBuyer ? copy.handoffBuyerFinal : copy.handoffSellerFinal}</strong>
            <p>{isBuyer ? copy.handoffBuyerHint : copy.handoffSellerHint}</p>
            <div className="deal-confirm-state">
              <div className={mineDone ? "confirm-state is-done" : "confirm-state"}>
                <span>{copy.dealMe}</span>
                <strong>{mineDone ? copy.dealConfirmDone : copy.dealConfirmNeeded}</strong>
              </div>
              <div className={peerDone ? "confirm-state is-done" : "confirm-state"}>
                <span>{copy.dealPeer}</span>
                <strong>{peerDone ? copy.dealConfirmDone : copy.dealWaiting}</strong>
              </div>
            </div>
            <Button
              fullWidth
              size="lg"
              disabled={busy || mineDone}
              onClick={() => void confirmHandoff()}
            >
              {mineDone
                ? copy.dealWaitingPeerConfirm
                : isBuyer
                  ? copy.handoffBuyerConfirm
                  : copy.handoffSellerConfirm}
            </Button>
          </section>

          <details className="dispute-panel">
            <summary>{copy.handoffDisputeSummary}</summary>
            <div className="section-stack">
              <div className="dispute-reason-grid">
                {options.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={
                      reason === option.value
                        ? "condition-option is-selected"
                        : "condition-option"
                    }
                    onClick={() => setReason(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <textarea
                className="dan-textarea dan-input"
                value={detail}
                maxLength={2000}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={copy.handoffDisputePh}
              />
              <Button
                fullWidth
                variant="secondary"
                disabled={busy}
                onClick={() => void submitDispute()}
              >
                {copy.handoffDisputeSubmit}
              </Button>
            </div>
          </details>
        </>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <Button to={`/match/${match.id}`} fullWidth variant="ghost">
        {copy.handoffChatCoordinate}
      </Button>
    </div>
  );
}
