import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductVisual } from "@/components/ProductVisual";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { fillCopyTemplate } from "@/copy/dealChain";
import { formatStoredComponents } from "@/copy/evidenceComponents";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDan } from "@/domain/danContext";
import type { DealEvidence, DealSnapshot } from "@/domain/types";
import { formatFulfillmentSummary } from "@/domain/fulfillment";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

function snapshotText(
  snapshot: Record<string, unknown> | undefined,
  section: string,
  key: string,
): string {
  const block = snapshot?.[section];
  if (!block || typeof block !== "object") return "";
  const value = (block as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function DealSnapshotPage() {
  const { matchId = "" } = useParams();
  const locale = useDanLocale();
  const copy = useDanCopy();
  const numberLocale = locale === "ja" ? "ja-JP" : "ko-KR";
  const {
    myMatches,
    state,
    getDemand,
    getProduct,
    currentUser,
    getDealEvidence,
    getDealSnapshot,
    confirmDealSnapshot,
    busy,
  } = useDan();
  const match = myMatches.find((m) => m.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const sell = match?.sellIntentId
    ? state.sellIntents.find((s) => s.id === match.sellIntentId)
    : undefined;

  const [evidence, setEvidence] = useState<DealEvidence | null>(null);
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [handoffPlace, setHandoffPlace] = useState("");
  const [handoffAt, setHandoffAt] = useState("");
  const [error, setError] = useState("");
  const [loadingDeal, setLoadingDeal] = useState(Boolean(matchId));

  useDeepHeader({ title: copy.snapshotTitle });

  useEffect(() => {
    if (!matchId) {
      setLoadingDeal(false);
      return;
    }
    let cancelled = false;
    setLoadingDeal(true);
    void Promise.all([getDealEvidence(matchId), getDealSnapshot(matchId)])
      .then(([e, d]) => {
        if (cancelled) return;
        setEvidence(e);
        setSnapshot(d);
        if (d) {
          setHandoffPlace(snapshotText(d.snapshot, "handoff", "place"));
          setHandoffAt(snapshotText(d.snapshot, "handoff", "at"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDeal(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getDealEvidence, getDealSnapshot, matchId]);

  const meetupRequired = Boolean(
    demand?.fulfillmentOptions.some((option) => option.mode === "MEETUP"),
  );

  const payload = useMemo(() => {
    if (!match || !demand || !product || !sell || !evidence) return null;
    return {
      product: {
        id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
      },
      offer: {
        price: sell.minimumPrice,
        approxUsageCount: sell.approxUsageCount ?? null,
        conditionNote: sell.conditionNote ?? "",
      },
      evidence: {
        serialLast4: evidence.serialLast4 ?? null,
        usageCount: evidence.usageCount ?? null,
        purchaseDate: evidence.purchaseDate ?? null,
        warrantyUntil: evidence.warrantyUntil ?? null,
        components: evidence.components,
        cosmeticNotes: evidence.cosmeticNotes,
        knownIssues: evidence.knownIssues,
        repairHistory: evidence.repairHistory,
        waterDamageStatement: evidence.waterDamageStatement,
      },
      handoff: {
        // Persist mode codes — never a KO/JA display string — so Handoff can
        // localize from demand.fulfillmentOptions (or fall back to modes).
        method: demand.fulfillmentOptions.map((option) => option.mode).join("|"),
        place: meetupRequired ? handoffPlace.trim() : "",
        at: meetupRequired ? handoffAt : "",
      },
    };
  }, [
    match,
    demand,
    product,
    sell,
    evidence,
    meetupRequired,
    handoffPlace,
    handoffAt,
  ]);

  if (loadingDeal) {
    return (
      <div className="page-stack page-narrow" role="status" aria-busy="true">
        <span className="sr-only">{copy.loadingScreen}</span>
        <div className="skeleton-line skeleton-line--lg" />
        <div className="skeleton-line" />
      </div>
    );
  }

  if (!match || !demand || !product || !sell || !currentUser) {
    return (
      <EmptyState
        title={copy.dealMissingTitle}
        action={<Button to="/my">{copy.dealMyTrades}</Button>}
      />
    );
  }

  const isBuyer = currentUser.id === match.buyerId;
  const myConfirmed = isBuyer
    ? Boolean(snapshot?.buyerConfirmedAt)
    : Boolean(snapshot?.sellerConfirmedAt);
  const peerConfirmed = isBuyer
    ? Boolean(snapshot?.sellerConfirmedAt)
    : Boolean(snapshot?.buyerConfirmedAt);
  const currency = demand.currencyCode ?? "KRW";
  const money = (value: number) => formatStoredMoney(value, currency, locale);

  const appointmentReady =
    !meetupRequired || Boolean(handoffPlace.trim() && handoffAt);

  async function confirm() {
    if (!payload || !appointmentReady || busy) return;
    const activeSell = sell;
    if (!activeSell) return;
    setError("");
    const result = await confirmDealSnapshot({
      matchId,
      agreedPrice: activeSell.minimumPrice,
      snapshot: payload,
    });
    if (!result) {
      setError(copy.snapshotSaveFail);
      return;
    }
    setSnapshot(result);
  }

  if (snapshot?.snapshot?.accountDeleted === true) {
    return (
      <div className="page-stack page-narrow deal-page">
        <h1 className="page-title">{copy.snapshotClosedTitle}</h1>
        <p>{copy.snapshotClosedBody}</p>
        <p>
          {copy.snapshotClosedStatus}:{" "}
          {match.status === "COMPLETED"
            ? copy.snapshotClosedCompleted
            : copy.snapshotClosedEnded}
        </p>
        <p>
          {copy.snapshotAgreedAmount}:{" "}
          {formatStoredMoney(
            snapshot.agreedPrice,
            snapshot.currencyCode ?? demand?.currencyCode ?? "KRW",
            locale,
          )}
        </p>
        <Button to="/my?tab=completed" variant="secondary">
          {copy.snapshotCompletedTrades}
        </Button>
      </div>
    );
  }
  if (!evidence) {
    return (
      <EmptyState
        title={copy.snapshotNoEvidenceTitle}
        body={isBuyer ? copy.snapshotNoEvidenceBuyer : copy.snapshotNoEvidenceSeller}
        action={
          isBuyer ? (
            <Button to="/my" variant="secondary">
              {copy.dealTradeList}
            </Button>
          ) : (
            <Button to={`/deal/${match.id}/evidence`}>
              {copy.snapshotRegisterEvidence}
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="page-stack page-narrow deal-page">
      <section className="deal-product-card deal-product-card--snapshot">
        <div className="deal-product-card__main">
          <ProductVisual product={product} size="sm" />
          <div>
            <h1 className="page-title">{product.name}</h1>
            <strong className="deal-price">{money(sell.minimumPrice)}</strong>
          </div>
        </div>
      </section>

      <section className="deal-snapshot-card deal-snapshot-card--focused">
        <div className="snapshot-card-heading">
          <div>
            <h2>{copy.snapshotConfirmHeading}</h2>
          </div>
          <strong>{money(sell.minimumPrice)}</strong>
        </div>

        {evidence.usageCount != null ? (
          <div className="snapshot-section snapshot-section--key">
            <span>
              {product.category === "camera" ? copy.dealShutterCount : copy.dealUsageCount}
            </span>
            <strong>
              {product.category === "camera"
                ? fillCopyTemplate(copy.dealShutterCountValue, {
                    n: evidence.usageCount.toLocaleString(numberLocale),
                  })
                : evidence.usageCount.toLocaleString(numberLocale)}
            </strong>
          </div>
        ) : null}
        <div className="snapshot-section snapshot-section--key">
          <span>{copy.dealAppearance}</span>
          <strong>{evidence.cosmeticNotes || copy.dealNotSubmitted}</strong>
        </div>
        <div className="snapshot-section snapshot-section--key">
          <span>{copy.dealKnownIssues}</span>
          <strong>{evidence.knownIssues || copy.dealNotSubmitted}</strong>
        </div>
        <div className="snapshot-section snapshot-section--key">
          <span>{copy.dealTradeMethod}</span>
          <strong>
            {formatFulfillmentSummary(demand.fulfillmentOptions, locale)}
          </strong>
        </div>

        <details className="snapshot-details">
          <summary>
            <span>
              <strong>{copy.snapshotSellerInfo}</strong>
              <small>{copy.snapshotSellerInfoSub}</small>
            </span>
            <span className="snapshot-details__chevron" aria-hidden>
              ⌄
            </span>
          </summary>
          <div className="snapshot-details__body">
            <div className="snapshot-section">
              <span>{copy.snapshotProductInfo}</span>
              <strong>{product.name}</strong>
            </div>
            <div className="snapshot-section">
              <span>{copy.evidencePurchaseDate}</span>
              <strong>{evidence.purchaseDate || copy.dealNotSubmitted}</strong>
            </div>
            <div className="snapshot-section">
              <span>{copy.snapshotWarranty}</span>
              <strong>{evidence.warrantyUntil || copy.dealNotSubmitted}</strong>
            </div>
            <div className="snapshot-section">
              <span>{copy.snapshotSerialLast4}</span>
              <strong>
                {evidence.serialLast4 ? `••••${evidence.serialLast4}` : copy.dealNotSubmitted}
              </strong>
            </div>
            <div className="snapshot-section">
              <span>{copy.dealComponents}</span>
              <strong>
                {formatStoredComponents(evidence.components, copy) || copy.dealNone}
              </strong>
            </div>
            <div className="snapshot-section">
              <span>{copy.snapshotRepair}</span>
              <strong>{evidence.repairHistory || copy.dealNone}</strong>
            </div>
            <div className="snapshot-section">
              <span>{copy.snapshotWater}</span>
              <strong>{evidence.waterDamageStatement || copy.dealNotSubmitted}</strong>
            </div>
          </div>
        </details>
      </section>

      {meetupRequired ? (
        <section className="deal-snapshot-card snapshot-appointment">
          <div className="snapshot-card-heading">
            <div>
              <h2>{copy.snapshotMeetupTitle}</h2>
            </div>
          </div>
          {snapshot?.lockedAt ? (
            <>
              <div className="snapshot-section snapshot-section--key">
                <span>{copy.snapshotMeetupPlace}</span>
                <strong>{handoffPlace || copy.snapshotTbd}</strong>
              </div>
              <div className="snapshot-section snapshot-section--key">
                <span>{copy.snapshotMeetupAt}</span>
                <strong>
                  {handoffAt
                    ? new Date(handoffAt).toLocaleString(numberLocale, {
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : copy.snapshotTbd}
                </strong>
              </div>
            </>
          ) : (
            <div className="section-stack">
              <Field label={copy.snapshotMeetupPlace} hint={copy.snapshotMeetupPlaceHint}>
                <TextInput
                  value={handoffPlace}
                  onChange={(event) => setHandoffPlace(event.target.value)}
                  placeholder={copy.snapshotMeetupPlacePh}
                  maxLength={120}
                />
              </Field>
              <Field label={copy.snapshotMeetupAt}>
                <input
                  className="dan-input"
                  type="datetime-local"
                  value={handoffAt}
                  onChange={(event) => setHandoffAt(event.target.value)}
                />
              </Field>
            </div>
          )}
        </section>
      ) : null}

      <section className="snapshot-lock-notice">
        <strong>{copy.snapshotLockTitle}</strong>
        <p>{copy.snapshotLockBody}</p>
      </section>

      <section className="deal-confirm-state">
        <div className={myConfirmed ? "confirm-state is-done" : "confirm-state"}>
          <span>{copy.dealMe}</span>
          <strong>{myConfirmed ? copy.dealConfirmDone : copy.dealConfirmNeeded}</strong>
        </div>
        <div className={peerConfirmed ? "confirm-state is-done" : "confirm-state"}>
          <span>{copy.dealPeer}</span>
          <strong>{peerConfirmed ? copy.dealConfirmDone : copy.dealWaiting}</strong>
        </div>
      </section>

      {snapshot?.lockedAt ? (
        <>
          <section className="safe-payment-placeholder">
            <span className="safe-payment-placeholder__icon">✓</span>
            <div>
              <strong>{copy.snapshotLockedTitle}</strong>
              <p>{copy.snapshotLockedBody}</p>
            </div>
          </section>
          <Button to={`/deal/${match.id}/payment`} fullWidth size="lg">
            {copy.dealPayCta}
          </Button>
        </>
      ) : (
        <>
          {meetupRequired && !appointmentReady ? (
            <p className="form-error" role="alert">
              {copy.snapshotNeedAppointment}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            fullWidth
            size="lg"
            disabled={busy || !payload || !appointmentReady || myConfirmed}
            onClick={() => void confirm()}
          >
            {myConfirmed ? copy.dealWaitingPeerConfirm : copy.snapshotConfirmCta}
          </Button>
        </>
      )}

      <Button to={`/match/${match.id}`} variant="secondary" fullWidth>
        {copy.dealBackToChat}
      </Button>
    </div>
  );
}
