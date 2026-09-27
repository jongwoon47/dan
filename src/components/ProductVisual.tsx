import type { Product, ProductCategory } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import "./productVisual.css";

function CameraGlyph() {
  return (
    <svg
      className="product-visual__camera"
      viewBox="0 0 64 48"
      fill="none"
      aria-hidden
    >
      <rect x="7" y="12" width="50" height="30" rx="7" fill="currentColor" opacity="0.16" />
      <path d="M18 12l4-6h20l4 6" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <rect x="8.5" y="13.5" width="47" height="27" rx="5.5" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="27" r="10" fill="var(--dan-surface)" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="27" r="5" fill="currentColor" opacity="0.28" />
      <circle cx="49" cy="19" r="2" fill="currentColor" />
    </svg>
  );
}

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
      className={`product-visual product-visual--${size} ${product.category === "camera" ? "product-visual--camera" : ""}`}
      aria-hidden
    >
      {product.category === "camera" ? (
        <CameraGlyph />
      ) : (
        <span className="product-visual__initial">{initial}</span>
      )}
      {size !== "sm" ? (
        <span className="product-visual__caption">{product.brand || product.name}</span>
      ) : null}
    </div>
  );
}

export function CategoryPill({ category }: { category: ProductCategory }) {
  if (category === "other") return null;
  return <span className="category-pill">{CATEGORY_LABEL[category]}</span>;
}
