import { useMemo, useState } from "react";
import { AggregatedDemandCard } from "@/components/AggregatedDemandCard";
import { IndividualDemandCard } from "@/components/IndividualDemandCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Chip, TextInput } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import { buildFeedItems } from "@/domain/feed";
import type { FeedAreaFilter } from "@/domain/fulfillment";
import { formatFulfillmentCardLine } from "@/domain/fulfillment";
import type { DemandType } from "@/domain/types";
import { DEMAND_TYPE_LABEL } from "@/domain/types";
import "./pages.css";
import "@/components/feedCards.css";

type Filter = "all" | DemandType;

export function DemandFeedPage() {
  const { state, currentUser, demandFeed, products } = useDan();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [areaFilter, setAreaFilter] = useState<FeedAreaFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const areaFeed = useMemo(
    () =>
      buildFeedItems(products, state.demands, {
        areaFilter,
        viewerDefaultArea: currentUser?.defaultArea ?? "",
      }),
    [products, state.demands, areaFilter, currentUser?.defaultArea],
  );

  const source = areaFilter === "all" ? demandFeed : areaFeed;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return source.filter((item) => {
      if (filter !== "all") {
        if (item.kind === "aggregated" && filter !== "BUY") return false;
        if (item.kind === "individual" && item.demand.type !== filter) return false;
      }
      if (!q) return true;
      if (item.kind === "aggregated") {
        return (
          item.product.name.toLowerCase().includes(q) ||
          item.product.brand.toLowerCase().includes(q) ||
          (item.aggregate.fulfillmentSummary ?? "").toLowerCase().includes(q)
        );
      }
      return (
        item.demand.title.toLowerCase().includes(q) ||
        formatFulfillmentCardLine(item.demand.fulfillmentOptions)
          .toLowerCase()
          .includes(q) ||
        item.demand.description.toLowerCase().includes(q)
      );
    });
  }, [source, filter, query]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">{ko.feedTitle}</h1>
        <p className="section-desc">{ko.feedDesc}</p>
      </header>

      <TextInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={ko.searchPh}
        aria-label={ko.searchPh}
      />

      <div className="feed-filter-bar">
        <div className="feed-filter-scroll" role="toolbar" aria-label="유형 필터">
          <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
            {ko.all}
          </Chip>
          {(["BUY", "BORROW", "TASK", "SERVICE"] as DemandType[]).map((t) => (
            <Chip key={t} selected={filter === t} onClick={() => setFilter(t)}>
              {DEMAND_TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          className={
            filtersOpen || areaFilter !== "all"
              ? "feed-filter-toggle is-active"
              : "feed-filter-toggle"
          }
          onClick={() => setFiltersOpen((v) => !v)}
        >
          {ko.filterMore}
        </button>
      </div>

      {filtersOpen ? (
        <div className="feed-filter-scroll" role="toolbar" aria-label="지역 필터">
          <Chip selected={areaFilter === "all"} onClick={() => setAreaFilter("all")}>
            {ko.all}
          </Chip>
          <Chip
            selected={areaFilter === "nearby"}
            onClick={() => setAreaFilter("nearby")}
          >
            {ko.filterNearby}
          </Chip>
          <Chip
            selected={areaFilter === "online"}
            onClick={() => setAreaFilter("online")}
          >
            {ko.filterOnline}
          </Chip>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={ko.noSearch}
          body={ko.noSearchBody}
          action={
            <Button to="/create" variant="secondary">
              {ko.ctaCreate}
            </Button>
          }
        />
      ) : (
        <div className="feed-list">
          {filtered.map((item) =>
            item.kind === "aggregated" ? (
              <AggregatedDemandCard
                key={item.id}
                product={item.product}
                aggregate={item.aggregate}
              />
            ) : (
              <IndividualDemandCard key={item.id} demand={item.demand} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
