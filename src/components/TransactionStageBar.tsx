type TransactionStage = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { step: 1, label: "정보" },
  { step: 2, label: "조건" },
  { step: 3, label: "결제" },
  { step: 4, label: "인계" },
] as const;

export function TransactionStageBar({
  stage,
}: {
  stage: TransactionStage;
}) {
  return (
    <div className="transaction-stage-bar" aria-label="거래 진행 단계">
      {STEPS.map((item, index) => {
        const done = stage > item.step;
        const current = stage === item.step;
        return (
          <div
            key={item.step}
            className={
              done
                ? "transaction-stage is-done"
                : current
                  ? "transaction-stage is-current"
                  : "transaction-stage"
            }
          >
            <span>{done ? "✓" : item.step}</span>
            <b>{item.label}</b>
            {index < STEPS.length - 1 ? <i aria-hidden /> : null}
          </div>
        );
      })}
    </div>
  );
}
