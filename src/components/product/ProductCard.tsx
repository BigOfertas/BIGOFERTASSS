import React from "react";
import { Link } from "@tanstack/react-router";

import { ProductQuickAdd } from "@/components/product/ProductQuickAdd";
import { BRAND } from "@/config/brand";

interface ProductCardProps {
  id: string;
  slug?: string;
  name: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  time?: string | null;
  commercialType?: string | null;
  className?: string;
  priority?: boolean;
}

const COMMERCIAL_TYPE_LABELS: Record<string, string> = {
  torcedor: "Torcedor",
  feminino: "Feminino",
  jogador: "Jogador",
  retro: "Retrô",
  infantil: "Kids",
  calcao: "Shorts / calção",
  basquete: "Basquete",
};

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  slug,
  name,
  price,
  promotionalPrice,
  imageUrl,
  time,
  commercialType,
  className = "",
  priority = false,
}) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const hasPromotion =
    promotionalPrice !== null &&
    promotionalPrice !== undefined &&
    promotionalPrice >= 0 &&
    promotionalPrice < price;
  const formattedPrice = currency.format(hasPromotion ? promotionalPrice : price);
  const formattedOriginalPrice = hasPromotion ? currency.format(price) : null;
  const showImage = Boolean(imageUrl) && !imageFailed;
  const commercialLabel = commercialType ? COMMERCIAL_TYPE_LABELS[commercialType] : null;
  const metadata = [commercialLabel, time?.trim() || null].filter(Boolean).join(" · ");
  const productParams = { id: slug || id };

  return (
    <article
      data-product-card
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition duration-200 hover:border-gray-300 hover:shadow-sm motion-reduce:transition-none ${className}`}
    >
      <Link
        to="/product/$id"
        params={productParams}
        aria-label={`Ver ${name}`}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/40"
      >
        <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gray-50">
          {hasPromotion ? (
            <span className="absolute left-2.5 top-2.5 z-[30] rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white sm:text-[10px]">
              Oferta
            </span>
          ) : null}

          {showImage ? (
            <img
              src={imageUrl ?? undefined}
              alt={name}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              width={640}
              height={640}
              sizes="(max-width: 639px) 48vw, (max-width: 1023px) 31vw, 260px"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-contain !object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold italic uppercase text-gray-300">
              <span className="text-lg font-black tracking-[-0.06em] text-red-500/20">
                {BRAND.shortMark}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-2.5 pb-3 pt-3 sm:px-3.5 sm:pb-4">
        <Link
          to="/product/$id"
          params={productParams}
          className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
        >
          {metadata ? (
            <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 sm:text-[11px]">
              {metadata}
            </p>
          ) : null}

          <h2 className="line-clamp-2 min-h-[30px] text-[12px] font-bold leading-[1.3] tracking-[-0.015em] text-gray-900 transition-colors group-hover:text-red-600 sm:min-h-[38px] sm:text-[14px]">
            {name}
          </h2>
        </Link>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            {formattedOriginalPrice ? (
              <span className="mb-0.5 block text-[10px] font-semibold tracking-tight text-gray-400 line-through sm:text-xs">
                {formattedOriginalPrice}
              </span>
            ) : null}
            <span className="block truncate text-base font-black tracking-[-0.04em] text-gray-950 sm:text-xl">
              {formattedPrice}
            </span>
          </div>

          <ProductQuickAdd
            productId={id}
            productSlug={slug}
            productName={name}
            imageUrl={imageUrl ?? null}
          />
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
