import type { Product, ProductCategory } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import "./productVisual.css";

function CameraGlyph({ brand }: { brand?: string | null }) {
  const brandMark = (brand || "DAN").slice(0, 8).toUpperCase();
  return (
    <svg className="product-visual__camera" viewBox="0 0 96 68" fill="none" aria-hidden>
      <defs>
        <linearGradient id="cameraBody" x1="18" y1="13" x2="78" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#35363C" /><stop offset="1" stopColor="#111216" />
        </linearGradient>
        <radialGradient id="cameraLens" cx="0" cy="0" r="1" gradientTransform="translate(49 39) rotate(90) scale(16)">
          <stop stopColor="#67708C" /><stop offset="0.34" stopColor="#20242E" /><stop offset="0.72" stopColor="#0C0E12" /><stop offset="1" stopColor="#343843" />
        </radialGradient>
      </defs>
      <path d="M19 20.5 25 12h19l4 7h25c5 0 9 4 9 9v23c0 5-4 9-9 9H19c-5 0-9-4-9-9v-22c0-5 4-9 9-9Z" fill="url(#cameraBody)" />
      <path d="M17 24h64" stroke="#686B74" strokeWidth="1.2" opacity=".75" />
      <rect x="20" y="16" width="13" height="5" rx="2.5" fill="#15161A" stroke="#81838B" />
      <circle cx="69" cy="29" r="3.2" fill="#17181C" stroke="#8C8E95" />
      <circle cx="49" cy="39" r="18" fill="#181A20" stroke="#777B88" strokeWidth="1.5" />
      <circle cx="49" cy="39" r="13" fill="url(#cameraLens)" stroke="#A2A7B5" />
      <circle cx="49" cy="39" r="5.5" fill="#0B0C10" stroke="#535A6D" />
      <path d="M28 54h42" stroke="#4E515B" />
      <text x="17" y="34" fill="#D8D9DE" fontSize="5.5" fontWeight="700" fontFamily="Arial, sans-serif">{brandMark}</text>
    </svg>
  );
}

export function ProductVisual({ product, size = "md" }: { product: Product; size?: "sm" | "md" | "lg"; }) {
  const initial = (product.name.trim()[0] ?? "?").toUpperCase();
  return (
    <div className={`product-visual product-visual--${size} ${product.category === "camera" ? "product-visual--camera" : ""}`} aria-hidden>
      {product.category === "camera" ? <CameraGlyph brand={product.brand} /> : <span className="product-visual__initial">{initial}</span>}
      {size !== "sm" ? <span className="product-visual__caption">{product.brand || product.name}</span> : null}
    </div>
  );
}

export function CategoryPill({ category }: { category: ProductCategory }) {
  if (category === "other") return null;
  return <span className="category-pill">{CATEGORY_LABEL[category]}</span>;
}
