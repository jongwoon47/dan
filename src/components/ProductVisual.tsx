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


function LensGlyph() {
  return (
    <svg className="product-visual__named-art product-visual__named-art--lens" viewBox="0 0 96 72" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lensBody" x1="20" y1="8" x2="75" y2="66" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3A3B42" /><stop offset="1" stopColor="#111216" />
        </linearGradient>
      </defs>
      <ellipse cx="49" cy="13" rx="23" ry="7" fill="#202127" stroke="#767985" />
      <path d="M26 13h46l-5 45c-.7 6-5.8 10-11.8 10H42.8C36.8 68 31.7 64 31 58l-5-45Z" fill="url(#lensBody)" stroke="#666A74" />
      <path d="M29 28h40M30 39h38M31 51h36" stroke="#7D808A" opacity=".55" />
      <ellipse cx="49" cy="13" rx="17" ry="4.5" fill="#090A0D" stroke="#A2A7B5" />
      <ellipse cx="49" cy="13" rx="9" ry="2.8" fill="#2E3440" />
    </svg>
  );
}

function PhoneGlyph() {
  return (
    <svg className="product-visual__named-art product-visual__named-art--phone" viewBox="0 0 72 96" fill="none" aria-hidden>
      <defs>
        <linearGradient id="phoneBody" x1="13" y1="8" x2="58" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C9D2DC" /><stop offset=".46" stopColor="#F7F8FA" /><stop offset="1" stopColor="#A7B2BE" />
        </linearGradient>
      </defs>
      <rect x="14" y="5" width="44" height="86" rx="10" fill="url(#phoneBody)" stroke="#87919D" />
      <rect x="18" y="9" width="36" height="78" rx="7" fill="#E7EBF0" />
      <circle cx="26" cy="20" r="5.4" fill="#323743" stroke="#B7C0C9" />
      <circle cx="39" cy="20" r="5.4" fill="#323743" stroke="#B7C0C9" />
      <circle cx="26" cy="33" r="5.4" fill="#323743" stroke="#B7C0C9" />
      <circle cx="40.5" cy="33" r="2.3" fill="#828C96" />
      <rect x="29" y="11" width="10" height="3" rx="1.5" fill="#B8C0C9" />
    </svg>
  );
}

function LaptopGlyph() {
  return (
    <svg className="product-visual__named-art product-visual__named-art--laptop" viewBox="0 0 104 72" fill="none" aria-hidden>
      <defs>
        <linearGradient id="screenGlow" x1="24" y1="12" x2="77" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4A347F" /><stop offset=".48" stopColor="#6D5EF7" /><stop offset="1" stopColor="#D9D7FF" />
        </linearGradient>
      </defs>
      <rect x="20" y="7" width="64" height="45" rx="4" fill="#1F2228" stroke="#8C939C" />
      <rect x="24" y="11" width="56" height="37" rx="2.5" fill="url(#screenGlow)" />
      <path d="M13 55h78l-7 9H20l-7-9Z" fill="#C8CDD4" stroke="#8E959D" />
      <path d="M42 57h20" stroke="#969DA6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChairGlyph() {
  return (
    <svg className="product-visual__named-art product-visual__named-art--chair" viewBox="0 0 82 96" fill="none" aria-hidden>
      <path d="M29 8c-7 2-11 8-11 16v28h45V24c0-8-4-14-11-16H29Z" fill="#3A3B3F" stroke="#7A7B80" />
      <path d="M24 16c11 6 22 6 33 0M24 27c11 6 22 6 33 0M24 38c11 6 22 6 33 0" stroke="#56585E" />
      <rect x="20" y="50" width="44" height="11" rx="5.5" fill="#25262A" stroke="#66686D" />
      <path d="M41 61v14M41 75l-20 8M41 75l20 8M41 75v13" stroke="#44464B" strokeWidth="4" strokeLinecap="round" />
      <circle cx="20" cy="84" r="3" fill="#34363B" />
      <circle cx="62" cy="84" r="3" fill="#34363B" />
      <circle cx="41" cy="90" r="3" fill="#34363B" />
      <path d="M20 41H11v22M64 41h9v22" stroke="#4A4C51" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function NamedProductArt({ product }: { product: Product }) {
  const name = product.name.toLocaleLowerCase("en");
  if (product.category === "lens") return <LensGlyph />;
  if (name.includes("iphone")) return <PhoneGlyph />;
  if (name.includes("macbook")) return <LaptopGlyph />;
  if (name.includes("aeron") || product.category === "furniture") return <ChairGlyph />;
  return null;
}

type GlyphKind =
  | "device"
  | "game"
  | "audio"
  | "home"
  | "chair"
  | "fashion"
  | "watch"
  | "outdoor"
  | "book"
  | "music"
  | "pet"
  | "tool"
  | "car"
  | "box";

function glyphKind(category: ProductCategory): GlyphKind {
  switch (category) {
    case "electronics":
    case "computer":
      return "device";
    case "gaming":
      return "game";
    case "audio":
      return "audio";
    case "home_appliance":
      return "home";
    case "furniture":
      return "chair";
    case "fashion":
    case "shoes":
    case "beauty":
      return "fashion";
    case "watches_accessories":
      return "watch";
    case "sports":
    case "outdoor":
    case "camping":
      return "outdoor";
    case "hobby_collectible":
    case "baby_kids":
    case "books_media":
      return "book";
    case "musical_instrument":
      return "music";
    case "pet":
      return "pet";
    case "tools":
      return "tool";
    case "auto":
      return "car";
    default:
      return "box";
  }
}

function GenericProductGlyph({ category }: { category: ProductCategory }) {
  const kind = glyphKind(category);
  const strokeProps = {
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <span className="product-visual__category-glyph" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        {kind === "device" ? (
          <>
            <rect x="4" y="5" width="16" height="11" rx="2" {...strokeProps} />
            <path d="M9 20h6M12 16v4" {...strokeProps} />
          </>
        ) : kind === "game" ? (
          <>
            <path d="M7.5 8h9c2.4 0 4.2 2.4 3.5 4.7l-1.1 3.8c-.5 1.7-2.7 2.1-3.8.7L13.8 15h-3.6l-1.3 2.2c-1 1.4-3.3 1-3.8-.7L4 12.7C3.3 10.4 5.1 8 7.5 8Z" {...strokeProps} />
            <path d="M8 10.5v3M6.5 12h3M15.8 11.2h.1M17.4 13h.1" {...strokeProps} />
          </>
        ) : kind === "audio" ? (
          <>
            <path d="M5 13v-2a7 7 0 0 1 14 0v2" {...strokeProps} />
            <rect x="4" y="12" width="4" height="7" rx="2" {...strokeProps} />
            <rect x="16" y="12" width="4" height="7" rx="2" {...strokeProps} />
          </>
        ) : kind === "home" ? (
          <>
            <path d="m4 11 8-6 8 6" {...strokeProps} />
            <path d="M6.5 10v9h11v-9M10 19v-5h4v5" {...strokeProps} />
          </>
        ) : kind === "chair" ? (
          <>
            <path d="M8 4.5h8v8H8zM7 12.5h10v3H7z" {...strokeProps} />
            <path d="M8 15.5 6.5 20M16 15.5l1.5 4.5M8 9H5.5v6.5M16 9h2.5v6.5" {...strokeProps} />
          </>
        ) : kind === "fashion" ? (
          <>
            <path d="m8.5 6 3.5-2 3.5 2 3 1.5-2 4-2-1V20h-5V10.5l-2 1-2-4L8.5 6Z" {...strokeProps} />
          </>
        ) : kind === "watch" ? (
          <>
            <path d="M9 3h6l1 4H8l1-4ZM8 17h8l-1 4H9l-1-4Z" {...strokeProps} />
            <circle cx="12" cy="12" r="5" {...strokeProps} />
            <path d="M12 9v3l2 1" {...strokeProps} />
          </>
        ) : kind === "outdoor" ? (
          <>
            <path d="m3 19 6.2-9 3 4 2.1-3L21 19H3Z" {...strokeProps} />
            <path d="m14.8 7 .7-2 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z" {...strokeProps} />
          </>
        ) : kind === "book" ? (
          <>
            <path d="M5 5.5c2.8-.6 5 .1 7 1.8v11c-2-1.7-4.2-2.4-7-1.8v-11Z" {...strokeProps} />
            <path d="M19 5.5c-2.8-.6-5 .1-7 1.8v11c2-1.7 4.2-2.4 7-1.8v-11Z" {...strokeProps} />
          </>
        ) : kind === "music" ? (
          <>
            <path d="M9 17V6l9-2v11" {...strokeProps} />
            <circle cx="6.5" cy="17.5" r="2.5" {...strokeProps} />
            <circle cx="15.5" cy="15.5" r="2.5" {...strokeProps} />
          </>
        ) : kind === "pet" ? (
          <>
            <circle cx="7" cy="8" r="1.6" {...strokeProps} />
            <circle cx="11" cy="5.8" r="1.6" {...strokeProps} />
            <circle cx="15.5" cy="6.6" r="1.6" {...strokeProps} />
            <circle cx="18" cy="10" r="1.6" {...strokeProps} />
            <path d="M8.4 17.4c.6-3 2.1-5.2 4.4-5.2s4.2 2.4 4.1 4.7c-.1 1.9-2 2.8-3.6 2.1-1.1-.5-1.7-.5-2.7.1-1.5.8-2.6-.1-2.2-1.7Z" {...strokeProps} />
          </>
        ) : kind === "tool" ? (
          <>
            <path d="M14.5 5.2a4 4 0 0 0-4.7 5L4.5 15.5a2.1 2.1 0 0 0 3 3l5.3-5.3a4 4 0 0 0 5-4.7l-2.7 2.7-2.3-.5-.5-2.3 2.2-3.2Z" {...strokeProps} />
          </>
        ) : kind === "car" ? (
          <>
            <path d="m5 15 1.6-5h10.8L19 15" {...strokeProps} />
            <rect x="3.5" y="13" width="17" height="5" rx="2" {...strokeProps} />
            <circle cx="7" cy="18" r="1.5" {...strokeProps} />
            <circle cx="17" cy="18" r="1.5" {...strokeProps} />
          </>
        ) : (
          <>
            <path d="m5 8 7-4 7 4-7 4-7-4Z" {...strokeProps} />
            <path d="M5 8v8l7 4 7-4V8M12 12v8" {...strokeProps} />
          </>
        )}
      </svg>
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
  const isCamera = product.category === "camera";
  const namedArt = <NamedProductArt product={product} />;
  const hasNamedArt = Boolean(namedArt);
  return (
    <div
      className={[
        "product-visual",
        `product-visual--${size}`,
        isCamera || hasNamedArt ? "product-visual--rich" : "product-visual--generic",
        isCamera ? "product-visual--camera" : "",
        `product-visual--cat-${product.category}`,
      ].filter(Boolean).join(" ")}
      aria-hidden
    >
      {isCamera ? (
        <CameraGlyph brand={product.brand} />
      ) : hasNamedArt ? (
        namedArt
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
