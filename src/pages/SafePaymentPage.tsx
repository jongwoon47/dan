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
    currentUser,
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
  const isBuyer = Boolean(match && currentUser?.id === match.buyerId);

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
        body="양쪽이 거래 조건을 확인한 뒤 결제할 수 있어요."
        action={<Button to={"/deal/" + match.id + "/snapshot"}>거래 조건 확인</Button>}
      />
    );
  }

  if (match.paymentStatus === "PAID") {
    return (
      <EmptyState
        title="안전결제가 확인됐어요"
        body="이제 판매자와 물품 인계 방법을 조율하세요."
        action={<Button to={"/deal/" + match.id + "/handoff"}>인계 진행</Button>}
      />
    );
  }

  async function pay() {
    if (!isBuyer || !isDemo || busy) return;
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

      {isBuyer && isDemo ? (
        <section className="payment-methods">
          <div className="payment-section-head">
            <h2>결제 수단</h2>
            <span>결제 수단</span>
          </div>
          <button type="button" className={method === "card" ? "payment-method is-selected" : "payment-method"} onClick={() => setMethod("card")}>
            <span>카드 결제</span><strong>{method === "card" ? "✓" : ""}</strong>
          </button>
          <button type="button" className={method === "bank" ? "payment-method is-selected" : "payment-method"} onClick={() => setMethod("bank")}>
            <span>계좌 이체</span><strong>{method === "bank" ? "✓" : ""}</strong>
          </button>
        </section>
      ) : isBuyer ? (
        <section className="payment-provider-gate">
          <span className="payment-provider-gate__badge">Production safety gate</span>
          <h2>실제 결제사는 아직 연결하지 않았어요.</h2>
          <p>
            결제사 계약과 서버 webhook 검증이 완료되기 전에는 DAN이 결제 완료 상태를 만들지 않습니다.
          </p>
          <ul>
            <li>클라이언트에서 임의로 PAID 상태 변경 불가</li>
            <li>확정된 거래 조건 이후에만 결제를 진행할 수 있어요.</li>
            <li>결제사 서버 확인 후에만 인계 단계 오픈</li>
          </ul>
          <Button to={"/deal/" + match.id + "/snapshot"} variant="secondary" fullWidth>
            확정된 거래 조건 다시 보기
          </Button>
        </section>
      ) : (
        <section className="offer-next-state">
          <strong>구매자 결제를 기다리고 있어요</strong>
          <p>구매자의 안전결제가 서버에서 확인되면 직거래 인계 단계가 열려요.</p>
        </section>
      )}

      <div className="payment-safety-note">
        <strong>결제 완료 여부는 서버에서 확인해요.</strong>
        <p>앱 화면만으로 결제 상태를 바꾸지 않습니다. 결제가 확인되기 전에는 판매자에게 물건을 인도받지 마세요.</p>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {isBuyer && isDemo ? (
        <>
          <Button fullWidth size="lg" disabled={busy} onClick={() => void pay()}>
            {busy ? "결제 확인 중…" : formatWon(snapshot.agreedPrice) + " 결제하기"}
          </Button>
          <p className="payment-production-note">
            테스트 환경에서는 실제 결제가 진행되지 않습니다.
          </p>
        </>
      ) : !isBuyer ? (
        <Button to="/my?tab=selling" fullWidth variant="secondary">내 판매 제안으로</Button>
      ) : null}
    </div>
  );
}
