import { ko } from "@/copy/ko";
import type { PriceBucket } from "@/domain/types";
import "./priceDistribution.css";

const MIN_SEEKER_FOR_CHART = 3;

export function PriceDistribution({
  buckets,
  seekerCount,
}: {
  buckets: PriceBucket[];
  seekerCount?: number;
}) {
  const visible = buckets.filter((b) => b.count > 0);
  const total = visible.reduce((sum, b) => sum + b.count, 0);
  const effectiveSeekers = seekerCount ?? total;

  if (effectiveSeekers < MIN_SEEKER_FOR_CHART || visible.length === 0) {
    return <p className="price-dist__empty">{ko.priceDistEmpty}</p>;
  }

  const max = Math.max(...visible.map((b) => b.count), 1);

  return (
    <div className="price-dist">
      {visible.map((bucket) => (
        <div key={bucket.label} className="price-dist__row">
          <span className="price-dist__label">{bucket.label}</span>
          <div className="price-dist__track" aria-hidden>
            <div
              className="price-dist__bar"
              style={{ width: `${(bucket.count / max) * 100}%` }}
            />
          </div>
          <span className="price-dist__count">
            {bucket.count}
            {ko.myung}
          </span>
        </div>
      ))}
    </div>
  );
}
