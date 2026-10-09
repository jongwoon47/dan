import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProductVisual } from "@/components/ProductVisual";
import { useDeepHeader } from "@/components/layout/ShellChrome";
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

  useDeepHeader({ title: "거래 조건 확인" });

  useEffect(() => {
    if (!matchId) return;
    void Promise.all([getDealEvidence(matchId), getDealSnapshot(matchId)]).then(
      ([e, d]) => {
        setEvidence(e);
        setSnapshot(d);
        if (d) {
          setHandoffPlace(snapshotText(d.snapshot, "handoff", "place"));
          setHandoffAt(snapshotText(d.snapshot, "handoff", "at"));
        }
      },
    );
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
        method: formatFulfillmentSummary(demand.fulfillmentOptions),
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

  if (!match || !demand || !product || !sell || !currentUser) {
    return (
      <EmptyState
        title="거래 정보를 찾을 수 없어요"
        action={<Button to="/my" variant="secondary">내 거래</Button>}
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
      setError("거래 조건을 저장하지 못했어요.");
      return;
    }
    setSnapshot(result);
  }

  if (snapshot?.snapshot?.accountDeleted === true) {
    return <div className="page-stack page-narrow deal-page">
      <h1 className="page-title">종료된 거래 기록</h1>
      <p>회원탈퇴로 개인 작성 내용과 상품 확인 정보가 삭제됐어요.</p>
      <p>거래 상태: {match.status === 'COMPLETED' ? '완료' : '종료'}</p>
      <p>합의 금액: {formatStoredMoney(snapshot.agreedPrice, snapshot.currencyCode ?? demand?.currencyCode ?? "KRW", locale)}</p>
      <Button to="/my?tab=completed" variant="secondary">완료된 거래</Button>
    </div>;
  }
  if (!evidence) {
    return (
      <EmptyState
        title="상품 정보가 아직 없어요"
        body={isBuyer ? "판매자가 상품 정보를 등록하면 거래 조건을 확인할 수 있어요." : "먼저 상품 상태와 확인 정보를 등록해 주세요."}
        action={
          isBuyer ? (
            <Button to="/my" variant="secondary">거래 목록</Button>
          ) : (
            <Button to={`/deal/${match.id}/evidence`}>상품 정보 등록</Button>
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
            <strong className="deal-price">{formatStoredMoney(sell.minimumPrice, demand?.currencyCode ?? "KRW", locale)}</strong>
          </div>
        </div>
      </section>

      <section className="deal-snapshot-card deal-snapshot-card--focused">
        <div className="snapshot-card-heading">
          <div>
            <h2>거래 조건을 확인해 주세요</h2>
          </div>
          <strong>{formatStoredMoney(sell.minimumPrice, demand?.currencyCode ?? "KRW", locale)}</strong>
        </div>

        {evidence.usageCount != null ? (
          <div className="snapshot-section snapshot-section--key">
            <span>{product.category === "camera" ? "컷수" : "사용량 / 횟수"}</span>
            <strong>
              {product.category === "camera"
                ? `${evidence.usageCount.toLocaleString("ko-KR")}컷`
                : evidence.usageCount.toLocaleString("ko-KR")}
            </strong>
          </div>
        ) : null}
        <div className="snapshot-section snapshot-section--key">
          <span>외관</span>
          <strong>{evidence.cosmeticNotes || "미제출"}</strong>
        </div>
        <div className="snapshot-section snapshot-section--key">
          <span>기능 이상</span>
          <strong>{evidence.knownIssues || "미제출"}</strong>
        </div>
        <div className="snapshot-section snapshot-section--key">
          <span>거래 방식</span>
          <strong>{formatFulfillmentSummary(demand.fulfillmentOptions)}</strong>
        </div>

        <details className="snapshot-details">
          <summary>
            <span>
              <strong>판매자 등록 정보</strong>
              <small>보증·구성품·수리 이력</small>
            </span>
            <span className="snapshot-details__chevron" aria-hidden>⌄</span>
          </summary>
          <div className="snapshot-details__body">
            <div className="snapshot-section">
              <span>제품 정보</span>
              <strong>{product.name}</strong>
            </div>
            <div className="snapshot-section">
              <span>구매일</span>
              <strong>{evidence.purchaseDate || "미제출"}</strong>
            </div>
            <div className="snapshot-section">
              <span>보증기간</span>
              <strong>{evidence.warrantyUntil || "미제출"}</strong>
            </div>
            <div className="snapshot-section">
              <span>식별번호 끝자리</span>
              <strong>{evidence.serialLast4 ? `••••${evidence.serialLast4}` : "미제출"}</strong>
            </div>
            <div className="snapshot-section">
              <span>구성품</span>
              <strong>{evidence.components.join(", ") || "없음"}</strong>
            </div>
            <div className="snapshot-section">
              <span>수리 이력</span>
              <strong>{evidence.repairHistory || "없음"}</strong>
            </div>
            <div className="snapshot-section">
              <span>침수 / 물손상 이력</span>
              <strong>{evidence.waterDamageStatement || "미제출"}</strong>
            </div>
          </div>
        </details>
      </section>

      {meetupRequired ? (
        <section className="deal-snapshot-card snapshot-appointment">
          <div className="snapshot-card-heading">
            <div>
              <h2>직거래 약속</h2>
            </div>
          </div>
          {snapshot?.lockedAt ? (
            <>
              <div className="snapshot-section snapshot-section--key">
                <span>만남 장소</span>
                <strong>{handoffPlace || "미정"}</strong>
              </div>
              <div className="snapshot-section snapshot-section--key">
                <span>약속 시간</span>
                <strong>
                  {handoffAt
                    ? new Date(handoffAt).toLocaleString("ko-KR", {
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "미정"}
                </strong>
              </div>
            </>
          ) : (
            <div className="section-stack">
              <Field
                label="만남 장소"
                hint="이 거래 참여자만 볼 수 있어요."
              >
                <TextInput
                  value={handoffPlace}
                  onChange={(event) => setHandoffPlace(event.target.value)}
                  placeholder="예: 강남역 11번 출구 스타벅스 앞"
                  maxLength={120}
                />
              </Field>
              <Field label="약속 시간">
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
        <strong>확인하면 이 조건으로 거래가 확정돼요.</strong>
        <p>양쪽 확인 후에는 수정할 수 없어요. 다르면 먼저 채팅에서 조율하세요.</p>
      </section>

      <section className="deal-confirm-state">
        <div className={myConfirmed ? "confirm-state is-done" : "confirm-state"}>
          <span>나</span><strong>{myConfirmed ? "확인 완료" : "확인 필요"}</strong>
        </div>
        <div className={peerConfirmed ? "confirm-state is-done" : "confirm-state"}>
          <span>상대</span><strong>{peerConfirmed ? "확인 완료" : "대기 중"}</strong>
        </div>
      </section>

      {snapshot?.lockedAt ? (
        <>
          <section className="safe-payment-placeholder">
            <span className="safe-payment-placeholder__icon">✓</span>
            <div>
              <strong>거래 조건이 확정됐어요</strong>
              <p>
                결제 후 인계할 때 같은 거래 조건을 다시 확인하세요.
              </p>
            </div>
          </section>
          <Button to={`/deal/${match.id}/payment`} fullWidth size="lg">
            결제하기
          </Button>
        </>
      ) : (
        <>
          {meetupRequired && !appointmentReady ? (
            <p className="form-error">직거래 장소와 시간을 입력해야 거래 조건을 확인할 수 있어요.</p>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
          <Button
            fullWidth
            size="lg"
            disabled={busy || !payload || !appointmentReady || myConfirmed}
            onClick={() => void confirm()}
          >
            {myConfirmed ? "상대 확인 대기 중" : "거래 조건 확인"}
          </Button>
        </>
      )}

      <Button to={`/match/${match.id}`} variant="secondary" fullWidth>
        채팅으로 돌아가기
      </Button>
    </div>
  );
}
