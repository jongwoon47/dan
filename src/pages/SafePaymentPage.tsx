import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDanCopy } from "@/copy/useDanCopy";
import { fillCopyTemplate } from "@/copy/dealChain";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import type { DealSnapshot } from "@/domain/types";
import { useDanLocale } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./pages.css";

export function SafePaymentPage() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();
  const locale = useDanLocale();
  const copy = useDanCopy();
  const {
    myMatches,
    currentUser,
    getProduct,
    getDemand,
    getDealSnapshot,
    simulateSafePaymentDemo,
    busy,
  } = useDan();
  const match = myMatches.find((row) => row.id === matchId);
  const demand = match ? getDemand(match.demandId) : undefined;
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [method, setMethod] = useState<"card" | "bank">("card");
  const [error, setError] = useState("");
  const isDemo = getDataMode() === "demo";
  const isBuyer = Boolean(match && currentUser?.id === match.buyerId);
  const moneyCurrency = snapshot?.currencyCode ?? demand?.currencyCode ?? "KRW";
  const money = (value: number) => formatStoredMoney(value, moneyCurrency, locale);

  useDeepHeader({ title: copy.paymentTitle });

  useEffect(() => {
    if (!matchId) return;
    void getDealSnapshot(matchId).then(setSnapshot);
  }, [getDealSnapshot, matchId]);

  if (!match || !product) {
    return (
      <EmptyState
        title={copy.dealMissingTitle}
        action={<Button to="/my">{copy.dealMyTrades}</Button>}
      />
    );
  }

  if (!snapshot?.lockedAt) {
    return (
      <EmptyState
        title={copy.paymentNeedLockTitle}
        body={copy.paymentNeedLockBody}
        action={
          <Button to={"/deal/" + match.id + "/snapshot"}>{copy.paymentReviewTerms}</Button>
        }
      />
    );
  }

  if (match.paymentStatus === "PAID") {
    return (
      <EmptyState
        title={copy.paymentAlreadyTitle}
        body={copy.paymentAlreadyBody}
        action={
          <Button to={"/deal/" + match.id + "/handoff"}>{copy.paymentHandoffCta}</Button>
        }
      />
    );
  }

  async function pay() {
    if (!isBuyer || !isDemo || busy) return;
    setError("");
    const ok = await simulateSafePaymentDemo(matchId);
    if (!ok) {
      setError(copy.paymentStatusFail);
      return;
    }
    navigate("/deal/" + matchId + "/handoff");
  }

  return (
    <div className="page-stack page-narrow safe-payment-page">
      <section className="payment-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <span>{copy.paymentAmountLabel}</span>
          <h1>{money(snapshot.agreedPrice)}</h1>
          <p>{product.name}</p>
        </div>
      </section>

      <section className="payment-breakdown">
        <div>
          <span>{copy.paymentProductAmount}</span>
          <strong>{money(snapshot.agreedPrice)}</strong>
        </div>
        <div>
          <span>{copy.paymentFee}</span>
          <strong>{money(0)}</strong>
        </div>
        <div className="is-total">
          <span>{copy.paymentTotal}</span>
          <strong>{money(snapshot.agreedPrice)}</strong>
        </div>
      </section>

      {isBuyer && isDemo ? (
        <section className="payment-methods">
          <div className="payment-section-head">
            <h2>{copy.paymentMethodTitle}</h2>
            <span>{copy.paymentMethodPick}</span>
          </div>
          <button
            type="button"
            className={method === "card" ? "payment-method is-selected" : "payment-method"}
            onClick={() => setMethod("card")}
          >
            <span>{copy.paymentCard}</span>
            <strong>{method === "card" ? "✓" : ""}</strong>
          </button>
          <button
            type="button"
            className={method === "bank" ? "payment-method is-selected" : "payment-method"}
            onClick={() => setMethod("bank")}
          >
            <span>{copy.paymentBank}</span>
            <strong>{method === "bank" ? "✓" : ""}</strong>
          </button>
        </section>
      ) : isBuyer ? (
        <section className="payment-provider-gate">
          <span className="payment-provider-gate__badge">{copy.paymentGateBadge}</span>
          <h2>{copy.paymentGateTitle}</h2>
          <p>{copy.paymentGateBody}</p>
          <Button to={"/deal/" + match.id + "/snapshot"} variant="secondary" fullWidth>
            {copy.paymentGateReview}
          </Button>
        </section>
      ) : (
        <section className="offer-next-state">
          <strong>{copy.paymentWaitBuyerTitle}</strong>
          <p>{copy.paymentWaitBuyerBody}</p>
        </section>
      )}

      <div className="payment-safety-note">
        <strong>{copy.paymentSafetyTitle}</strong>
        <p>{copy.paymentSafetyBody}</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {isBuyer && isDemo ? (
        <Button fullWidth size="lg" disabled={busy} onClick={() => void pay()}>
          {busy
            ? copy.paymentConfirming
            : fillCopyTemplate(copy.paymentPayAmount, { amount: money(snapshot.agreedPrice) })}
        </Button>
      ) : !isBuyer ? (
        <Button to="/my" fullWidth variant="secondary">
          {copy.paymentToMyTrades}
        </Button>
      ) : null}
    </div>
  );
}
