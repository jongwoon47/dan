import type { Product, ProductCategory } from "@/domain/types";
import { CATEGORY_LABEL } from "@/domain/types";
import "./productVisual.css";

const CATEGORY_SYMBOL: Record<ProductCategory, string> = {
  electronics: "전",
  computer: "PC",
  gaming: "G",
  audio: "A",
  camera: "카",
  lens: "L",
  home_appliance: "가",
  furniture: "F",
  fashion: "패",
  shoes: "S",
  watches_accessories: "W",
  sports: "SP",
  outdoor: "O",
  camping: "C",
  hobby_collectible: "H",
  baby_kids: "K",
  books_media: "B",
  musical_instrument: "M",
  beauty: "뷰",
  pet: "P",
  tools: "T",
  auto: "AU",
  other: "•",
};

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

function GenericProductGlyph({ category }: { category: ProductCategory }) {
  return (
    <span className="product-visual__category-glyph" aria-hidden>
      {CATEGORY_SYMBOL[category]}
    </span>
  );
}

export function ProductVisual({
  product,
  size = "md",
}: {
  product: Product;
  size?: "sm" | "md" | "lg";
}) {
  const isCameraLike = product.category === "camera" || product.category === "lens";
  return (
    <div
      className={[
        "product-visual",
        `product-visual--${size}`,
        isCameraLike ? "product-visual--camera" : "product-visual--generic",
      ].join(" ")}
      aria-hidden
    >
      {isCameraLike ? (
        <CameraGlyph brand={product.brand} />
      ) : (
        <GenericProductGlyph category={product.category} />
      )}
      {size !== "sm" ? (
        <span className="product-visual__caption">
          {product.brand || CATEGORY_LABEL[product.category]}
        </span>
      ) : null}
    </div>
  );
}

export function CategoryPill({ category }: { category: ProductCategory }) {
  if (category === "other") return null;
  return <span className="category-pill">{CATEGORY_LABEL[category]}</span>;
}
