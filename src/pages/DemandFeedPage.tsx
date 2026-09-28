import { useMemo, useState } from "react";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useDan } from "@/domain/danContext";
import { DAN_V1_CAMERA_NAMES, DAN_V1_CAMERA_NAME_SET } from "@/domain/danV1";
import "./pages.css";
import "@/components/feedCards.css";

export function DemandFeedPage() {
  const { demandFeed } = useDan();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return demandFeed
      .filter(
        (item) =>
          item.kind === "aggregated" &&
          DAN_V1_CAMERA_NAME_SET.has(item.product.name) &&
          item.aggregate.seekerCount > 0,
      )
      .sort((a, b) => {
        if (a.kind !== "aggregated" || b.kind !== "aggregated") return 0;
        return (
          DAN_V1_CAMERA_NAMES.indexOf(
            a.product.name as (typeof DAN_V1_CAMERA_NAMES)[number],
          ) -
          DAN_V1_CAMERA_NAMES.indexOf(
            b.product.name as (typeof DAN_V1_CAMERA_NAMES)[number],
          )
        );
      })
      .filter((item) => {
        if (!q || item.kind !== "aggregated") return true;
        return (
          item.product.name.toLowerCase().includes(q) ||
          item.product.brand.toLowerCase().includes(q) ||
          (item.aggregate.fulfillmentSummary ?? "").toLowerCase().includes(q)
        );
      });
  }, [demandFeed, query]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">지금 사고 있는 사람들</h1>
        <p className="section-desc">
          DAN V1은 프리미엄 중고 카메라 5종의 살아 있는 구매수요만 보여줘요.
          판매자는 이 수요를 보고 바로 Quick Offer를 보낼 수 있습니다.
        </p>
      </header>

      <TextInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="카메라 모델 검색"
        aria-label="카메라 모델 검색"
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="조건에 맞는 Live Demand가 없어요"
          body="사고 싶은 카메라와 가격을 먼저 남겨보세요."
          action={
            <Button to="/buy/new" variant="secondary">
              구매수요 등록
            </Button>
          }
        />
      ) : (
        <div className="live-demand-list">
          {filtered.map((item) =>
            item.kind === "aggregated" ? (
              <AggregatedDemandCard
                key={item.id}
                product={item.product}
                aggregate={item.aggregate}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
