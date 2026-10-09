import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDanLocale } from "@/i18n/locale";
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
  formatStoredMoney,
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
  const copy = useDanCopy();
  const locale = useDanLocale();
  const { demandId = "" } = useParams();
  const navigate = useNavigate();
  const {
    getDemand,
    createResponse,
    acceptResponse,
    declineResponse,
    withdrawResponse,
    closeDemand,
    extendBuyDemand,
    currentUser,
    state,
    busy,
    getPublicProfile,
  } = useDan();
  const demand = getDemand(demandId);
  useDeepHeader({
    title: demand ? (locale === "ja" ? (demand.type === "BUY" ? copy.typeBuy : demand.type === "BORROW" ? copy.typeBorrow : demand.type === "TASK" ? copy.typeTask : copy.typeService) : DEMAND_TYPE_LABEL[demand.type]) : copy.viewDemand,
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

  const buyOfferCount = useMemo(
    () =>
      state.matches.filter(
        (match) =>
          match.demandId === demandId &&
          Boolean(match.sellIntentId) &&
          match.status !== "DECLINED" &&
          match.status !== "CLOSED",
      ).length,
    [state.matches, demandId],
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
    if (status === "CLOSED") return copy.statusClosed;
    if (status === "MATCHED") return copy.statusMatched;
    if (status === "EXPIRED") return copy.statusExpired;
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
        title={copy.missingDemand}
        action={<Button to="/feed" variant="secondary">{copy.goBack}</Button>}
      />
    );
  }

  async function submitResponse(e: FormEvent) {
    e.preventDefault();
    if (busy || !demand) return;
    setLocalError(null);
    const msg = message.trim();
    if (!msg) {
      setLocalError(copy.genericError);
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
      setLocalError(copy.genericError);
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
            <span className="demand-chip demand-chip--open">{copy.statusActive}</span>
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
              ? copy.borrowBudgetTotal
              : demand.type === "TASK" || demand.type === "SERVICE"
                ? copy.reward
                : copy.detailBudget}
          </dt>
          <dd>{formatStoredMoney(demand.budget, demand.currencyCode ?? "KRW", locale)}</dd>
        </div>
        <div className="detail-facts__row">
          <dt>
            {demand.type === "BUY"
              ? copy.whereLabelBuy
              : demand.type === "BORROW"
                ? copy.whereLabelBorrow
                : demand.type === "SERVICE"
                  ? copy.whereLabelService
                  : copy.whereLabelTask}
          </dt>
          <dd>{formatFulfillmentModes(demand.fulfillmentOptions)}</dd>
        </div>
        {primaryPublicPlace(demand.fulfillmentOptions) ? (
          <div className="detail-facts__row">
            <dt>{copy.detailLocation}</dt>
            <dd>
              {formatPublicPlaceLine(
                primaryPublicPlace(demand.fulfillmentOptions)!,
                loadViewerGeo(),
                { revealDetail: revealLocation, locale },
              )}
            </dd>
          </div>
        ) : null}
        {formatDemandWhen(demand) ? (
          <div className="detail-facts__row">
            <dt>{copy.detailWhen}</dt>
            <dd>{formatDemandWhen(demand)}</dd>
          </div>
        ) : null}
        {demand.type === "SERVICE" &&
        formatDurationMinutes(demand.details.estimatedDurationMinutes) ? (
          <div className="detail-facts__row">
            <dt>{copy.detailDuration}</dt>
            <dd>
              {formatDurationMinutes(demand.details.estimatedDurationMinutes)}
            </dd>
          </div>
        ) : null}
      </dl>

      {isOwner && demandOpen ? (
        <div className="action-row demand-owner-actions">
          <Button
            variant="secondary"
            to={`/demand/item/${demand.id}/edit`}
          >
            {copy.editDemand}
          </Button>
          <Button
            variant="ghost"
            className="demand-close-action"
            onClick={() => setCloseOpen(true)}
            disabled={busy}
          >
            {copy.closeDemand}
          </Button>
        </div>
      ) : null}

      {isOwner && viewStatus === "EXPIRED" ? (
        <div className="section-stack">
          {demand.type === "BUY" ? (
            <>
              <p className="section-desc">{copy.expiredBuyAsk}</p>
              <Button
                fullWidth
                size="lg"
                disabled={busy}
                onClick={() => void extendBuyDemand(demand.id)}
              >
                {copy.extend30d}
              </Button>
            </>
          ) : (
            <>
              <p className="section-desc">{copy.expiredTimedBody}</p>
              <Button fullWidth size="lg" to={`/create?type=${demand.type}`}>
                {copy.recreateSimilar}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {!isOwner && !demandOpen ? (
        <div className="section-stack">
          {myConnectedMatch ? (
            <Button to={`/match/${myConnectedMatch.id}`} fullWidth size="lg">
              {copy.openChat}
            </Button>
          ) : (
            <p className="section-desc">{copy.demandClosed}</p>
          )}
        </div>
      ) : null}

      {localError ? <p className="form-error">{localError}</p> : null}

      {!isOwner && demandOpen && demand.type === "BUY" ? (
        <div className="section-stack">
          <p className="section-desc">{copy.haveItBody}</p>
          <Button to={`/demand/${demand.details.productId}`} fullWidth size="lg">
            {copy.haveIt}
          </Button>
        </div>
      ) : null}

      {!isOwner && demand.type !== "BUY" ? (
        <>
          {sent || myOpen ? (
            <div className="section-stack">
              <p className="section-desc">{copy.respondSent}</p>
              {myOpen ? (
                <>
                  <div className="response-card">
                    {myOpen.offeredPrice != null ? (
                      <div className="response-card__fact">
                        <span className="response-card__label">{copy.offerPrice}</span>
                        <strong className="response-card__price">
                          {formatStoredMoney(myOpen.offeredPrice, demand.currencyCode ?? "KRW", locale)}
                        </strong>
                      </div>
                    ) : null}
                    {myOpen.availabilityText ? (
                      <div className="response-card__fact">
                        <span className="response-card__label">
                          {copy.availabilityShort}
                        </span>
                        <span>{myOpen.availabilityText}</span>
                      </div>
                    ) : null}
                    <div className="response-card__fact">
                      <span className="response-card__label">{copy.responseMessage}</span>
                      <span>{myOpen.message}</span>
                    </div>
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
                      {copy.editResponse}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void withdrawResponse(myOpen.id)}
                    >
                      {copy.withdrawResponse}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {canRespond && composerOpen ? (
            <form className="composer-sheet" onSubmit={(e) => void submitResponse(e)}>
              <h2 className="section-title">{copy.respondSheetTitle}</h2>
              <label className="field">
                <span>
                  {copy.offerPrice} <em>{copy.offerPriceOptional}</em>
                </span>
                <input
                  inputMode="numeric"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder={
                    demand.budget > 0
                      ? `희망 ${demand.budget.toLocaleString("ko-KR")}원`
                      : copy.offerPriceOptional
                  }
                />
              </label>
              <label className="field">
                <span>
                  {copy.availability} <em>{copy.offerPriceOptional}</em>
                </span>
                <input
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  placeholder={copy.availabilityPh}
                />
              </label>
              <label className="field">
                <span>{copy.responseMessage}</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    demand.type === "BORROW"
                      ? `예: ${copy.respondBorrow}`
                      : demand.type === "SERVICE"
                        ? `예: ${copy.respondService}`
                        : copy.responseMessagePh
                  }
                  rows={3}
                  required
                />
              </label>
              <Button fullWidth type="submit" disabled={busy}>
                {busy ? copy.saving : copy.sendResponse}
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
              {copy.respondCta}
            </Button>
          ) : null}
        </>
      ) : null}

      {isOwner ? (
        <div className="section-stack demand-item__responses">
          {demand.type === "BUY" ? (
            <>
              <div className="demand-offer-summary">
                <div>
                  <span className="demand-offer-summary__label">받은 제안</span>
                  <strong>{buyOfferCount}</strong>
                </div>
                <Button
                  to="/my"
                  variant="secondary"
                >
                  제안 보기
                </Button>
              </div>
              {buyOfferCount === 0 ? (
                <p className="section-desc">판매 제안이 도착하면 여기에서 바로 확인할 수 있어요.</p>
              ) : (
                <p className="section-desc">가격과 상태를 비교한 뒤 관심 있는 제안을 선택하세요.</p>
              )}
            </>
          ) : (
            <h2 className="section-title">{copy.ownerResponsesLead}</h2>
          )}
          {demand.type === "BUY" ? null : ownerResponses.length === 0 ? (
            <div className="demand-item__empty">
              <p className="section-desc">{copy.ownerResponsesEmpty}</p>
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
                  <div className="response-card__fact">
                    <span className="response-card__label">{copy.offerPrice}</span>
                    <strong className="response-card__price">
                      {formatStoredMoney(r.offeredPrice, demand.currencyCode ?? "KRW", locale)}
                    </strong>
                  </div>
                ) : null}
                {r.availabilityText ? (
                  <div className="response-card__fact">
                    <span className="response-card__label">
                      {copy.availabilityShort}
                    </span>
                    <span>{r.availabilityText}</span>
                  </div>
                ) : null}
                <div className="response-card__fact">
                  <span className="response-card__label">{copy.responseMessage}</span>
                  <span>{r.message}</span>
                </div>
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
                      {copy.acceptResponseAction}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void declineResponse(r.id)}
                    >
                      {copy.declineResponse}
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
        title={copy.closeDemand}
        body={copy.closeDemandConfirm}
        confirmLabel={copy.closeDemand}
        danger
        onCancel={() => setCloseOpen(false)}
        onConfirm={() => void onCloseDemand()}
      />
    </div>
  );
}
