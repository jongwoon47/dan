import { ko } from "@/copy/ko";
import type { PriceBucket } from "@/domain/types";
import "./priceDistribution.css";

export function PriceDistribution({ buckets }: { buckets: PriceBucket[] }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="price-dist">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="price-dist__row">
          <span className="price-dist__label">{bucket.label}</span>
          <div className="price-dist__track" aria-hidden>
            <div
              className="price-dist__bar"
              style={{ width: `${Math.max((bucket.count / max) * 100, 6)}%` }}
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
