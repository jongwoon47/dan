import { useMemo, useState } from "react";
import { DemandCard } from "@/components/DemandCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Chip, ChipGroup, TextInput } from "@/components/ui/Input";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { ProductCategory } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import "./pages.css";

const FILTERS: Array<"all" | ProductCategory> = ["all", "camera", "lens", "electronics"];

export function DemandFeedPage() {
  const { demandFeed } = useDan();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return demandFeed.filter((row) => {
      if (category !== "all" && row.product.category !== category) return false;
      if (!q) return true;
      return (
        row.product.name.toLowerCase().includes(q) ||
        row.product.brand.toLowerCase().includes(q) ||
        row.product.model.toLowerCase().includes(q)
      );
    });
  }, [demandFeed, query, category]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">{ko.feedTitle}</h1>
        <p className="section-desc">{ko.feedDesc}</p>
      </header>
      <div className="feed-controls">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ko.searchPh}
          aria-label="search"
        />
        <ChipGroup>
          {FILTERS.map((key) => (
            <Chip key={key} selected={category === key} onClick={() => setCategory(key)}>
              {key === "all" ? ko.all : CATEGORY_LABEL[key]}
            </Chip>
          ))}
        </ChipGroup>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={ko.noSearch}
          body={ko.noSearchBody}
          action={<Button to="/create" variant="secondary">{ko.ctaCreate}</Button>}
        />
      ) : (
        <div className="grid-cards">
          {filtered.map((row) => (
            <DemandCard key={row.productId} product={row.product} aggregate={row} />
          ))}
        </div>
      )}
    </div>
  );
}
