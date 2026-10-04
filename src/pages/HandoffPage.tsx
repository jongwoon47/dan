import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDan } from "@/domain/danContext";
import type { DealDispute, DealDisputeReason, DealSnapshot } from "@/domain/types";
import { formatWon } from "@/lib/format";
import { useNavigate, useParams } from "react-router-dom";
import "./pages.css";

const DISPUTE_OPTIONS: Array<{ value: DealDisputeReason; label: string }> = [
  { value: "WRONG_ITEM", label: "다른 물건이에요" },
  { value: "SNAPSHOT_MISMATCH", label: "Deal Snapshot과 달라요" },
  { value: "MAJOR_UNDISCLOSED_DEFECT", label: "고지되지 않은 큰 하자가 있어요" },
  { value: "ITEM_NOT_RECEIVED", label: "물건을 받지 못했어요" },
  { value: "OTHER", label: "기타" },
];

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
  const {
    myMatches,
    currentUser,
    getDemand,
    getProduct,
    getDealSnapshot,
    listDealDisputes,
    openDealDispute,
    confirmMatchCompletion,
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

  useDeepHeader({ title: "거래 진행 중" });

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
  const handoffLabel = shippingOnly ? "배송 · 수령 확인" : "직거래 · 인계 확인";

  const facts = useMemo(() => {
    if (!snapshot) return [];
    const payload = snapshot.snapshot;
    const usage = snapshotString(payload, ["evidence", "usageCount"]);
    const rows: string[][] = [
      ["제품", snapshotString(payload, ["product", "name"]) || product?.name || ""],
      ["가격", formatWon(snapshot.agreedPrice)],
    ];
    if (usage) {
      rows.push([
        product?.category === "camera" ? "컷수" : "사용량 / 횟수",
        product?.category === "camera"
          ? `${Number(usage).toLocaleString("ko-KR")}컷`
          : Number(usage).toLocaleString("ko-KR"),
      ]);
    }
    rows.push(
      ["구성품", snapshotString(payload, ["evidence", "components"]) || "없음"],
      ["외관", snapshotString(payload, ["evidence", "cosmeticNotes"]) || "미제출"],
      ["기능 이상", snapshotString(payload, ["evidence", "knownIssues"]) || "미제출"],
      ["거래 방식", snapshotString(payload, ["handoff", "method"]) || "직거래"],
    );
    return rows;
  }, [product?.category, product?.name, snapshot]);

  if (!match || !currentUser || !demand || demand.type !== "BUY" || !product) {
    return (
      <EmptyState
        title="거래 정보를 찾을 수 없어요"
        action={<Button to="/my" variant="secondary">거래 목록</Button>}
      />
    );
  }

  if (!snapshot?.lockedAt) {
    return (
      <EmptyState
        title="먼저 거래 조건을 확정해 주세요"
        body="양쪽이 같은 Deal Snapshot을 확인해야 물품 인계 단계로 넘어갈 수 있어요."
        action={<Button to={`/deal/${match.id}/snapshot`}>거래 조건 확인</Button>}
      />
    );
  }

  if (match.paymentStatus !== "PAID") {
    return (
      <EmptyState
        title="안전결제가 먼저 필요해요"
        body="결제 완료가 서버에서 확인된 뒤 직거래 인계 단계가 열립니다."
        action={<Button to={"/deal/" + match.id + "/payment"}>안전결제</Button>}
      />
    );
  }

  async function confirmHandoff() {
    setError("");
    const updated = await confirmMatchCompletion(matchId);
    if (!updated) {
      setError("최종 확인을 저장하지 못했어요.");
      return;
    }
    if (updated.status === "COMPLETED") {
      navigate("/deal/" + matchId + "/complete");
    }
  }

  async function submitDispute() {
    if (!detail.trim() && reason === "OTHER") {
      setError("기타 사유는 내용을 적어주세요.");
      return;
    }
    setError("");
    const created = await openDealDispute({
      matchId,
      reason,
      detail: detail.trim(),
    });
    if (!created) {
      setError("분쟁을 접수하지 못했어요.");
      return;
    }
    setDisputes((prev) => [created, ...prev]);
  }

  return (
    <div className="page-stack page-narrow handoff-page">
      <section className="handoff-hero">
        <span className="eyebrow">인계 확인</span>
        <h1 className="page-title">{product.name}</h1>
        <p>확정한 조건을 기준으로 결제하고, 물품을 인계받을 때 실제 상태를 다시 확인해요.</p>
      </section>

      <section className="trade-progress-card" aria-label="거래 진행 단계">
        <div className="trade-progress-row is-done">
          <span className="trade-progress-icon">✓</span>
          <div><strong>거래조건 확정</strong><small>거래 조건 확인 완료</small></div>
        </div>
        <div className={match.paymentStatus === "PAID" ? "trade-progress-row is-done" : "trade-progress-row is-current"}>
          <span className="trade-progress-icon">{match.paymentStatus === "PAID" ? "✓" : "2"}</span>
          <div>
            <strong>구매자 안전결제</strong>
            <small>{match.paymentStatus === "PAID" ? "결제 완료" : "결제 대기 중"}</small>
          </div>
        </div>
        <div className={match.status === "COMPLETED" ? "trade-progress-row is-done" : match.paymentStatus === "PAID" ? "trade-progress-row is-current" : "trade-progress-row"}>
          <span className="trade-progress-icon">{match.status === "COMPLETED" ? "✓" : "3"}</span>
          <div>
            <strong>{handoffLabel}</strong>
            <small>{match.status === "COMPLETED" ? "거래 완료" : match.paymentStatus === "PAID" ? "채팅에서 인계 방법을 조율하세요" : "결제 완료 후 진행"}</small>
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
          <strong>거래가 분쟁 검토 상태예요</strong>
          <p>분쟁이 해결되기 전에는 거래 완료 처리를 진행하지 않습니다.</p>
          <span>{DISPUTE_OPTIONS.find((x) => x.value === openDispute.reason)?.label ?? openDispute.reason}</span>
        </section>
      ) : match.status === "COMPLETED" ? (
        <section className="trade-complete-card">
          <span className="safe-payment-placeholder__icon">✓</span>
          <div>
            <strong>거래가 완료됐어요</strong>
            <p>양쪽의 확인이 끝났습니다. 거래 결과는 거래 이력에 완료 기록으로 남아요.</p>
          </div>
          <Button to={`/profile/${currentUser.id}`} variant="secondary" fullWidth>
            내 거래 이력 보기
          </Button>
        </section>
      ) : (
        <>
          <section className="final-confirm-card">
            <strong>{isBuyer ? "구매자 최종 확인" : "판매자 최종 확인"}</strong>
            <p>
              {isBuyer
                ? "제품·구성품·상태가 위 조건과 일치할 때만 확인하세요."
                : "구매자가 제품을 확인한 뒤 실제 인도를 완료했을 때 확인하세요."}
            </p>
            <div className="deal-confirm-state">
              <div className={mineDone ? "confirm-state is-done" : "confirm-state"}>
                <span>나</span><strong>{mineDone ? "확인 완료" : "확인 필요"}</strong>
              </div>
              <div className={peerDone ? "confirm-state is-done" : "confirm-state"}>
                <span>상대</span><strong>{peerDone ? "확인 완료" : "대기 중"}</strong>
              </div>
            </div>
            <Button
              fullWidth
              size="lg"
              disabled={busy || mineDone}
              onClick={() => void confirmHandoff()}
            >
              {mineDone
                ? "상대 확인 대기 중"
                : isBuyer
                  ? "물품을 확인했습니다"
                  : "제품 인도를 완료했습니다"}
            </Button>
          </section>

          <details className="dispute-panel">
            <summary>확정한 거래 조건과 다르거나 문제가 있나요?</summary>
            <div className="section-stack">
              <div className="dispute-reason-grid">
                {DISPUTE_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={reason === option.value ? "condition-option is-selected" : "condition-option"}
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
                placeholder="확인한 문제를 구체적으로 적어주세요."
              />
              <Button fullWidth variant="secondary" disabled={busy} onClick={() => void submitDispute()}>
                거래 중지하고 분쟁 접수
              </Button>
            </div>
          </details>
        </>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <Button to={`/match/${match.id}`} fullWidth variant="ghost">
        채팅에서 인계 방법 조율
      </Button>
    </div>
  );
}
