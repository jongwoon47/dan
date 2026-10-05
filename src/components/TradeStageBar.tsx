type TradeStage = "info" | "terms" | "payment" | "handoff";

const STEPS: Array<{ key: TradeStage; label: string }> = [
  { key: "info", label: "상품 정보" },
  { key: "terms", label: "거래 조건" },
  { key: "payment", label: "결제" },
  { key: "handoff", label: "인계" },
];

const ORDER: Record<TradeStage, number> = {
  info: 0,
  terms: 1,
  payment: 2,
  handoff: 3,
};

export function TradeStageBar({
  current,
  completed = false,
}: {
  current: TradeStage;
  completed?: boolean;
}) {
  const currentIndex = ORDER[current];

  return (
    <div className="app-trade-stage" aria-label="거래 진행 단계">
      {STEPS.map((step, index) => {
        const done = completed || index < currentIndex;
        const active = !completed && index === currentIndex;
        return (
          <span
            key={step.key}
            className={done ? "is-done" : active ? "is-current" : ""}
          >
            <i aria-hidden>{done ? "✓" : index + 1}</i>
            <b>{step.label}</b>
          </span>
        );
      })}
    </div>
  );
}
