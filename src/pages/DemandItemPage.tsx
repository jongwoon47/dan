import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { effectiveDemandStatus, isDemandOpen } from "@/domain/demandLifecycle";
import {
  formatFulfillmentModes,
  primaryPublicPlace,
} from "@/domain/fulfillment";
import { DEMAND_TYPE_LABEL } from "@/domain/types";
import {
  clearResponseDraft,
  loadResponseDraft,
  saveResponseDraft,
} from "@/lib/actionDraft";
import {
  formatDemandWhen,
  formatDurationMinutes,
  formatWon,
} from "@/lib/format";
import {
  formatPublicPlaceLine,
  loadViewerGeo,
} from "@/lib/geoDistance";
import "./pages.css";

function responseStatusLabel(status: string) {
  if (status === "OPEN") return ko.statusOpen;
  if (status === "ACCEPTED") return ko.statusAccepted;
  if (status === "DECLINED") return ko.statusDeclined;
  if (status === "WITHDRAWN") return ko.statusWithdrawn;
  return status;
}

export function DemandItemPage() {
  const { demandId = "" } = useParams();
  const navigate = useNavigate();
  const {
    getDemand,
    createResponse,
    acceptResponse,
    declineResponse,
    withdrawResponse,
    closeDemand,
    currentUser,
    state,
    busy,
    getPublicProfile,
  } = useDan();
  const demand = getDemand(demandId);
  useDeepHeader({
    title: demand ? DEMAND_TYPE_LABEL[demand.type] : ko.viewDemand,
  });
  const restored = loadResponseDraft(demandId);
  const [composerOpen, setComposerOpen] = useState(Boolean(restored));
  const [offerPrice, setOfferPrice] = useState(restored?.offerPrice ?? "");
  const [availability, setAvailability] = useState(
    restored?.availability ?? "",
  );
  const [message, setMessage] = useState(restored?.message ?? "");
  const [sent, setSent] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);

  const myOpen = useMemo(
    () =>
      state.responses.find(
        (r) =>
          r.demandId === demandId &&
          r.userId === currentUser?.id &&
          r.status === "OPEN",
      ),
    [state.responses, demandId, currentUser?.id],
  );

  const ownerResponses = useMemo(
    () =>
      state.responses
        .filter((r) => r.demandId === demandId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.responses, demandId],
  );

  const isOwner = currentUser?.id === demand?.userId;
  const viewStatus = demand ? effectiveDemandStatus(demand) : "CLOSED";
  const demandOpen = demand ? isDemandOpen(demand) : false;
  const myConnectedMatch = useMemo(
    () =>
      state.matches.find(
        (m) =>
          m.demandId === demandId &&
          m.status === "CONNECTED" &&
          (m.buyerId === currentUser?.id || m.sellerId === currentUser?.id),
      ),
    [state.matches, demandId, currentUser?.id],
  );
  const revealLocation = Boolean(isOwner || myConnectedMatch);
  const canRespond = Boolean(
    demand && demand.type !== "BUY" && demandOpen && !isOwner,
  );

  function statusBadgeLabel(status: typeof viewStatus): string {
    if (status === "CLOSED") return ko.statusClosed;
    if (status === "MATCHED") return ko.statusMatched;
    if (status === "EXPIRED") return ko.statusExpired;
    return "";
  }

  const ownerResponderKey = ownerResponses.map((r) => r.userId).join(",");

  useEffect(() => {
    if (!isOwner || !ownerResponderKey) return;
    const ids = ownerResponderKey.split(",").filter(Boolean);
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        ids.map(async (id) => {
          const p = await getPublicProfile(id);
          const name = p?.displayName?.trim();
          if (name) next[id] = name;
        }),
      );
      if (!cancelled) setNames((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [getPublicProfile, isOwner, ownerResponderKey]);

  if (!demand) {
    return (
      <EmptyState
        title={ko.missingDemand}
        action={<Button to="/feed" variant="secondary">{ko.goBack}</Button>}
      />
    );
  }

  async function submitResponse(e: FormEvent) {
    e.preventDefault();
    if (busy || !demand) return;
    setLocalError(null);
    const msg = message.trim();
    if (!msg) {
      setLocalError(ko.genericError);
      return;
    }
    const price = offerPrice.trim() ? Number(offerPrice.replace(/,/g, "")) : undefined;
    // Preserve composer inputs across login redirect (full page assign).
    saveResponseDraft({
      demandId: demand.id,
      offerPrice,
      availability,
      message: msg,
    });
    const result = await createResponse({
      demandId: demand.id,
      message: msg,
      offeredPrice: Number.isFinite(price) ? price : undefined,
      availabilityText: availability.trim() || undefined,
    });
    if (!result) {
      setLocalError(ko.genericError);
      return;
    }
    clearResponseDraft();
    setSent(true);
    setComposerOpen(false);
  }

  async function onCloseDemand() {
    if (busy || !demand) return;
    const result = await closeDemand(demand.id);
    setCloseOpen(false);
    if (result) navigate("/my");
  }

  return (
    <div className="page-stack page-narrow demand-item">
      <header className="demand-item__header">
        <div className="demand-item__badges">
          <span className="demand-chip">{DEMAND_TYPE_LABEL[demand.type]}</span>
          {viewStatus !== "ACTIVE" ? (
            <span
              className={
                viewStatus === "EXPIRED"
                  ? "demand-chip demand-chip--expired"
                  : viewStatus === "MATCHED"
                    ? "demand-chip demand-chip--matched"
                    : "demand-chip demand-chip--closed"
              }
            >
              {statusBadgeLabel(viewStatus)}
            </span>
          ) : (
            <span className="demand-chip demand-chip--open">{ko.statusActive}</span>
          )}
        </div>
        <h1 className="page-title demand-item__title">{demand.title}</h1>
        {demand.description.trim() &&
        demand.description.trim() !== demand.title.trim() ? (
          <p className="section-desc demand-item__desc">{demand.description}</p>
        ) : null}
      </header>

      <dl className="detail-facts detail-facts--panel">
        <div className="detail-facts__row detail-facts__row--reward">
          <dt>
            {demand.type === "BORROW"
              ? ko.borrowBudgetTotal
              : demand.type === "TASK" || demand.type === "SERVICE"
                ? ko.reward
                : ko.detailBudget}
          </dt>
          <dd>{formatWon(demand.budget)}</dd>
        </div>
        <div className="detail-facts__row">
          <dt>
            {demand.type === "BUY"
              ? ko.whereLabelBuy
              : demand.type === "BORROW"
                ? ko.whereLabelBorrow
                : demand.type === "SERVICE"
                  ? ko.whereLabelService
                  : ko.whereLabelTask}
          </dt>
          <dd>{formatFulfillmentModes(demand.fulfillmentOptions)}</dd>
        </div>
        {primaryPublicPlace(demand.fulfillmentOptions) ? (
          <div className="detail-facts__row">
            <dt>{ko.detailLocation}</dt>
            <dd>
              {formatPublicPlaceLine(
                primaryPublicPlace(demand.fulfillmentOptions)!,
                loadViewerGeo(),
                { revealDetail: revealLocation },
              )}
            </dd>
          </div>
        ) : null}
        {formatDemandWhen(demand) ? (
          <div className="detail-facts__row">
            <dt>{ko.detailWhen}</dt>
            <dd>{formatDemandWhen(demand)}</dd>
          </div>
        ) : null}
        {demand.type === "SERVICE" &&
        formatDurationMinutes(demand.details.estimatedDurationMinutes) ? (
          <div className="detail-facts__row">
            <dt>{ko.detailDuration}</dt>
            <dd>
              {formatDurationMinutes(demand.details.estimatedDurationMinutes)}
            </dd>
          </div>
        ) : null}
      </dl>

      {isOwner && demandOpen ? (
        <div className="action-row action-row--split">
          <Button
            fullWidth
            variant="secondary"
            to={`/demand/item/${demand.id}/edit`}
          >
            {ko.editDemand}
          </Button>
          <Button
            fullWidth
            variant="secondary"
            onClick={() => setCloseOpen(true)}
            disabled={busy}
          >
            {ko.closeDemand}
          </Button>
        </div>
      ) : null}

      {!isOwner && !demandOpen ? (
        <div className="section-stack">
          {myConnectedMatch ? (
            <Button to={`/match/${myConnectedMatch.id}`} fullWidth size="lg">
              {ko.openChat}
            </Button>
          ) : (
            <p className="section-desc">{ko.demandClosed}</p>
          )}
        </div>
      ) : null}

      {localError ? <p className="form-error">{localError}</p> : null}

      {!isOwner && demandOpen && demand.type === "BUY" ? (
        <div className="section-stack">
          <p className="section-desc">{ko.haveItBody}</p>
          <Button to={`/demand/${demand.details.productId}`} fullWidth size="lg">
            {ko.haveIt}
          </Button>
        </div>
      ) : null}

      {!isOwner && demand.type !== "BUY" ? (
        <>
          {sent || myOpen ? (
            <div className="section-stack">
              <p className="section-desc">{ko.respondSent}</p>
              {myOpen ? (
                <>
                  <div className="response-card">
                    {myOpen.offeredPrice != null ? (
                      <p>
                        <strong>{formatWon(myOpen.offeredPrice)}</strong>
                      </p>
                    ) : null}
                    {myOpen.availabilityText ? <p>{myOpen.availabilityText}</p> : null}
                    <p>{myOpen.message}</p>
                    <p className="muted">{responseStatusLabel(myOpen.status)}</p>
                  </div>
                  <div className="action-row">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setOfferPrice(myOpen.offeredPrice?.toString() ?? "");
                        setAvailability(myOpen.availabilityText ?? "");
                        setMessage(myOpen.message);
                        setComposerOpen(true);
                      }}
                    >
                      {ko.editResponse}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void withdrawResponse(myOpen.id)}
                    >
                      {ko.withdrawResponse}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {canRespond && composerOpen ? (
            <form className="composer-sheet" onSubmit={(e) => void submitResponse(e)}>
              <h2 className="section-title">{ko.respondSheetTitle}</h2>
              <label className="field">
                <span>
                  {ko.offerPrice} <em>{ko.offerPriceOptional}</em>
                </span>
                <input
                  inputMode="numeric"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder={
                    demand.budget > 0
                      ? `요청 예산 ${demand.budget.toLocaleString("ko-KR")}원`
                      : ko.offerPriceOptional
                  }
                />
              </label>
              <label className="field">
                <span>
                  {ko.availability} <em>{ko.offerPriceOptional}</em>
                </span>
                <input
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder={ko.availabilityPh}
                />
              </label>
              <label className="field">
                <span>{ko.responseMessage}</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    demand.type === "BORROW"
                      ? `예: ${ko.respondBorrow}`
                      : demand.type === "SERVICE"
                        ? `예: ${ko.respondService}`
                        : ko.responseMessagePh
                  }
                  rows={3}
                  required
                />
              </label>
              <Button fullWidth type="submit" disabled={busy}>
                {busy ? ko.saving : ko.sendResponse}
              </Button>
            </form>
          ) : null}

          {canRespond && !composerOpen && !myOpen ? (
            <Button
              fullWidth
              size="lg"
              onClick={() => {
                clearResponseDraft();
                setMessage("");
                setOfferPrice("");
                setAvailability("");
                setComposerOpen(true);
              }}
            >
              {ko.respondCta}
            </Button>
          ) : null}
        </>
      ) : null}

      {isOwner ? (
        <div className="section-stack demand-item__responses">
          <h2 className="section-title">{ko.ownerResponsesLead}</h2>
          {demand.type === "BUY" ? (
            <p className="section-desc">
              <Button to={`/demand/${demand.details.productId}`} variant="secondary">
                {ko.viewDemand}
              </Button>
            </p>
          ) : ownerResponses.length === 0 ? (
            <div className="demand-item__empty">
              <p className="section-desc">{ko.ownerResponsesEmpty}</p>
            </div>
          ) : (
            ownerResponses.map((r) => (
              <div key={r.id} className="response-card">
                <div className="response-card__head">
                  {names[r.userId] ? (
                    <Link to={`/profile/${r.userId}`} className="text-link">
                      {names[r.userId]}
                    </Link>
                  ) : (
                    <Link
                      to={`/profile/${r.userId}`}
                      className="text-link muted"
                    >
                      상대
                    </Link>
                  )}
                  <span className="muted">{responseStatusLabel(r.status)}</span>
                </div>
                {r.offeredPrice != null ? (
                  <p className="response-card__price">{formatWon(r.offeredPrice)}</p>
                ) : null}
                {r.availabilityText ? <p>{r.availabilityText}</p> : null}
                <p>{r.message}</p>
                {r.status === "OPEN" && demandOpen ? (
                  <div className="action-row">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void acceptResponse(r.id).then((m) => {
                          if (m) navigate(`/match/${m.id}`);
                        })
                      }
                    >
                      {ko.acceptResponseAction}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void declineResponse(r.id)}
                    >
                      {ko.declineResponse}
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      <ConfirmSheet
        open={closeOpen}
        title={ko.closeDemand}
        body={ko.closeDemandConfirm}
        confirmLabel={ko.closeDemand}
        danger
        onCancel={() => setCloseOpen(false)}
        onConfirm={() => void onCloseDemand()}
      />
    </div>
  );
}
