import type { Product, ProductCategory } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import "./productVisual.css";

const CATEGORY_MARK: Record<ProductCategory, string> = {
  camera: "CAM",
  lens: "LENS",
  electronics: "GEAR",
  furniture: "HOME",
  camping: "OUT",
  other: "ITEM",
};

export function ProductVisual({
  product,
  size = "md",
}: {
  product: Product;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={`product-visual product-visual--${size}`}
      style={{
        background: `linear-gradient(145deg, hsl(${product.imageHue} 28% 22%), hsl(${product.imageHue} 18% 12%))`,
      }}
      aria-hidden
    >
      <span className="product-visual__mark">{CATEGORY_MARK[product.category]}</span>
      <span className="product-visual__brand">{product.brand}</span>
    </div>
  );
}

export function CategoryPill({ category }: { category: ProductCategory }) {
  return <span className="category-pill">{CATEGORY_LABEL[category]}</span>;
}
