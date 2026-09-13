import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { CATEGORY_LABEL, DEMAND_TYPE_LABEL } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

export function DemandItemPage() {
  const { demandId = "" } = useParams();
  const {
    getDemand,
    createResponse,
    acceptResponse,
    currentUser,
    state,
  } = useDan();
  const demand = getDemand(demandId);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!demand) {
    return (
      <EmptyState
        title={ko.missingDemand}
        action={<Button to="/feed" variant="secondary">{ko.goBack}</Button>}
      />
    );
  }

  const isOwner = currentUser?.id === demand.userId;
  const openResponses = state.responses.filter(
    (r) => r.demandId === demand.id && r.status === "OPEN",
  );

  const respondLabel =
    demand.type === "BORROW"
      ? ko.respondBorrow
      : demand.type === "SERVICE"
        ? ko.respondService
        : ko.respondCta;

  async function respond() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createResponse({
        demandId: demand!.id,
        message: respondLabel,
        offeredPrice: demand!.budget,
      });
      if (result) setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="feed-row__type">
          {CATEGORY_LABEL[demand.category]} · {DEMAND_TYPE_LABEL[demand.type]}
        </p>
        <h1 className="page-title">{demand.title}</h1>
        <p className="section-desc">{demand.description}</p>
      </header>

      <div className="detail-facts">
        <div>
          <span>{ko.detailWhere}</span>
          <strong>{formatFulfillmentSummary(demand.fulfillmentOptions)}</strong>
        </div>
        <div>
          <span>{ko.detailBudget}</span>
          <strong>{formatWon(demand.budget)}</strong>
        </div>
      </div>

      {!isOwner ? (
        sent ? (
          <p className="section-desc">{ko.respondSent}</p>
        ) : (
          <Button fullWidth size="lg" onClick={() => void respond()} disabled={busy}>
            {busy ? "..." : respondLabel}
          </Button>
        )
      ) : (
        <div className="section-stack">
          <h2 className="section-title">{ko.myResponses}</h2>
          {openResponses.length === 0 ? (
            <p className="section-desc">{ko.noMatchBody}</p>
          ) : (
            openResponses.map((r) => (
              <div key={r.id} className="response-row">
                <p>{r.message}</p>
                <Button
                  disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    setBusy(true);
                    void acceptResponse(r.id).finally(() => setBusy(false));
                  }}
                >
                  {ko.acceptResponse}
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
