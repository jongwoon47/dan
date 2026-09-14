import type { Product, ProductCategory } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import "./productVisual.css";

export function ProductVisual({
  product,
  size = "md",
}: {
  product: Product;
  size?: "sm" | "md" | "lg";
}) {
  const initial = (product.name.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      className={`product-visual product-visual--${size}`}
      aria-hidden
    >
      <span className="product-visual__initial">{initial}</span>
      {size !== "sm" ? (
        <span className="product-visual__caption">{product.brand || product.name}</span>
      ) : null}
    </div>
  );
}

export function CategoryPill({ category }: { category: ProductCategory }) {
  return <span className="category-pill">{CATEGORY_LABEL[category]}</span>;
}
