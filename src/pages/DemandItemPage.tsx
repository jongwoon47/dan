import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { CATEGORY_LABEL, DEMAND_TYPE_LABEL } from "@/domain/types";
import { formatDemandWhen, formatWon } from "@/lib/format";
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
    title: demand?.title ?? ko.viewDemand,
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [availability, setAvailability] = useState("");
  const [message, setMessage] = useState("");
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
  const canRespond = Boolean(
    demand &&
      demand.type !== "BUY" &&
      demand.status === "ACTIVE" &&
      !isOwner,
  );

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
          next[id] = p?.displayName ?? "DAN";
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
    const msg = message.trim() || ko.respondCta;
    const price = offerPrice.trim() ? Number(offerPrice.replace(/,/g, "")) : undefined;
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
    <div className="page-stack page-narrow">
      <header className="page-header">
        <p className="feed-row__type">
          {CATEGORY_LABEL[demand.category]} · {DEMAND_TYPE_LABEL[demand.type]}
          {demand.status !== "ACTIVE"
            ? ` · ${demand.status === "CLOSED" ? ko.statusClosed : ko.statusMatched}`
            : ""}
        </p>
        <p className="section-desc">{ko.demandFirstLead}</p>
        <p className="section-desc">{demand.description}</p>
      </header>

      <div className="detail-facts">
        <div>
          <span>{ko.detailWhere}</span>
          <strong>{formatFulfillmentSummary(demand.fulfillmentOptions)}</strong>
        </div>
        <div>
          <span>
            {demand.type === "BORROW"
              ? ko.borrowBudgetTotal
              : demand.type === "TASK" || demand.type === "SERVICE"
                ? ko.reward
                : ko.detailBudget}
          </span>
          <strong>{formatWon(demand.budget)}</strong>
        </div>
        {formatDemandWhen(demand) ? (
          <div>
            <span>{ko.detailWhen}</span>
            <strong>{formatDemandWhen(demand)}</strong>
          </div>
        ) : null}
      </div>

      {isOwner && demand.status === "ACTIVE" ? (
        <div className="action-row">
          <Button variant="secondary" to={`/demand/item/${demand.id}/edit`}>
            {ko.editDemand}
          </Button>
          <Button variant="secondary" onClick={() => setCloseOpen(true)} disabled={busy}>
            {ko.closeDemand}
          </Button>
        </div>
      ) : null}

      {localError ? <p className="form-error">{localError}</p> : null}

      {!isOwner && demand.type === "BUY" ? (
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
                  placeholder={String(demand.budget)}
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
                  placeholder={ko.responseMessagePh}
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
                setMessage(
                  demand.type === "BORROW"
                    ? ko.respondBorrow
                    : demand.type === "SERVICE"
                      ? ko.respondService
                      : ko.respondCta,
                );
                setOfferPrice(String(demand.budget));
                setComposerOpen(true);
              }}
            >
              {ko.respondToThisNeed}
            </Button>
          ) : null}
        </>
      ) : null}

      {isOwner ? (
        <div className="section-stack">
          <h2 className="section-title">{ko.ownerResponsesLead}</h2>
          {demand.type === "BUY" ? (
            <p className="section-desc">
              <Button to={`/demand/${demand.details.productId}`} variant="secondary">
                {ko.viewDemand}
              </Button>
            </p>
          ) : ownerResponses.length === 0 ? (
            <p className="section-desc">{ko.noMatchBody}</p>
          ) : (
            ownerResponses.map((r) => (
              <div key={r.id} className="response-card">
                <div className="response-card__head">
                  <Link to={`/profile/${r.userId}`} className="text-link">
                    {names[r.userId] ?? "…"}
                  </Link>
                  <span className="muted">{responseStatusLabel(r.status)}</span>
                </div>
                {r.offeredPrice != null ? (
                  <p className="response-card__price">{formatWon(r.offeredPrice)}</p>
                ) : null}
                {r.availabilityText ? <p>{r.availabilityText}</p> : null}
                <p>{r.message}</p>
                {r.status === "OPEN" && demand.status === "ACTIVE" ? (
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
