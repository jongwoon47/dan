import { ProductVisual } from "@/components/ProductVisual";
import type { Product } from "@/domain/types";
import { formatWon } from "@/lib/format";

type TradeStep = "info" | "terms" | "payment" | "handoff" | "complete";

const STEPS: Array<{ key: Exclude<TradeStep, "complete">; label: string }> = [
  { key: "info", label: "상품" },
  { key: "terms", label: "조건" },
  { key: "payment", label: "결제" },
  { key: "handoff", label: "인계" },
];

const ORDER: Record<TradeStep, number> = {
  info: 0,
  terms: 1,
  payment: 2,
  handoff: 3,
  complete: 4,
};

export function TradeFlowHeader({
  product,
  price,
  step,
  eyebrow = "거래 진행",
}: {
  product: Product;
  price?: number | null;
  step: TradeStep;
  eyebrow?: string;
}) {
  const current = ORDER[step];

  return (
    <section className="trade-flow-header">
      <div className="trade-flow-header__summary">
        <ProductVisual product={product} size="sm" />
        <div>
          <span>{eyebrow}</span>
          <strong>{product.name}</strong>
          {price != null && price > 0 ? <b>{formatWon(price)}</b> : null}
        </div>
      </div>

      <div className="trade-flow-header__steps" aria-label="거래 진행 단계">
        {STEPS.map((item, index) => {
          const done = current > index;
          const active = current === index;
          return (
            <span
              key={item.key}
              className={done ? "is-done" : active ? "is-active" : ""}
            >
              <i aria-hidden>{done ? "✓" : index + 1}</i>
              <b>{item.label}</b>
            </span>
          );
        })}
      </div>
    </section>
  );
}
