import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductVisual } from "@/components/ProductVisual";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { getDataMode } from "@/data/mode";
import { useDan } from "@/domain/danContext";
import type { DealSnapshot } from "@/domain/types";
import { formatWon } from "@/lib/format";
import "./pages.css";

export function SafePaymentPage() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();
  const {
    myMatches,
    getProduct,
    getDealSnapshot,
    simulateSafePaymentDemo,
    busy,
  } = useDan();
  const match = myMatches.find((row) => row.id === matchId);
  const product = match?.productId ? getProduct(match.productId) : undefined;
  const [snapshot, setSnapshot] = useState<DealSnapshot | null>(null);
  const [method, setMethod] = useState<"card" | "bank">("card");
  const [error, setError] = useState("");
  const isDemo = getDataMode() === "demo";

  useDeepHeader({ title: "안전결제" });

  useEffect(() => {
    if (!matchId) return;
    void getDealSnapshot(matchId).then(setSnapshot);
  }, [getDealSnapshot, matchId]);

  if (!match || !product) {
    return <EmptyState title="거래 정보를 찾을 수 없어요" action={<Button to="/my">내 구매수요</Button>} />;
  }

  if (!snapshot?.lockedAt) {
    return (
      <EmptyState
        title="먼저 거래 조건을 확정해 주세요"
        body="양쪽이 Deal Snapshot을 확인한 뒤 결제할 수 있어요."
        action={<Button to={"/deal/" + match.id + "/snapshot"}>거래 조건 확인</Button>}
      />
    );
  }

  if (match.paymentStatus === "PAID") {
    return (
      <EmptyState
        title="안전결제가 확인됐어요"
        body="이제 판매자와 직거래 시간과 장소를 조율하세요."
        action={<Button to={"/deal/" + match.id + "/handoff"}>직거래 진행</Button>}
      />
    );
  }

  async function pay() {
    if (!isDemo || busy) return;
    setError("");
    const ok = await simulateSafePaymentDemo(matchId);
    if (!ok) {
      setError("결제 상태를 변경하지 못했어요.");
      return;
    }
    navigate("/deal/" + matchId + "/handoff");
  }

  return (
    <div className="page-stack page-narrow safe-payment-page">
      <section className="payment-product-card">
        <ProductVisual product={product} size="sm" />
        <div>
          <span>결제 금액</span>
          <h1>{formatWon(snapshot.agreedPrice)}</h1>
          <p>{product.name}</p>
        </div>
      </section>

      <section className="payment-breakdown">
        <div><span>상품 금액</span><strong>{formatWon(snapshot.agreedPrice)}</strong></div>
        <div><span>수수료</span><strong>0원</strong></div>
        <div className="is-total"><span>총 결제 금액</span><strong>{formatWon(snapshot.agreedPrice)}</strong></div>
      </section>

      <section className="payment-methods">
        <h2>결제 수단</h2>
        <button type="button" className={method === "card" ? "payment-method is-selected" : "payment-method"} onClick={() => setMethod("card")}>
          <span>카드 결제</span><strong>{method === "card" ? "✓" : ""}</strong>
        </button>
        <button type="button" className={method === "bank" ? "payment-method is-selected" : "payment-method"} onClick={() => setMethod("bank")}>
          <span>계좌 이체</span><strong>{method === "bank" ? "✓" : ""}</strong>
        </button>
      </section>

      <div className="payment-safety-note">
        <strong>결제 완료 여부는 서버에서 확인해요.</strong>
        <p>앱 화면만으로 결제 상태를 바꾸지 않습니다. 결제가 확인되기 전에는 판매자에게 물건을 인도받지 마세요.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <Button fullWidth size="lg" disabled={!isDemo || busy} onClick={() => void pay()}>
        {isDemo ? (busy ? "결제 확인 중…" : formatWon(snapshot.agreedPrice) + " 결제하기") : "안전결제 연동 준비 중"}
      </Button>

      {!isDemo ? <p className="payment-production-note">실제 PG 결제 연동 전에는 결제 버튼을 활성화하지 않습니다.</p> : null}
    </div>
  );
}
