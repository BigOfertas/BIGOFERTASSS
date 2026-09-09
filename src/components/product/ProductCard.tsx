import React from "react";
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { BRAND } from "@/config/brand";
import { useFavorites } from "@/context/FavoritesContext";

interface ProductCardProps {
  id: string;
  slug?: string;
  name: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  hoverImageUrl?: string | null;
  time?: string | null;
  commercialType?: string | null;
  className?: string;
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

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  slug,
  name,
  price,
  promotionalPrice,
  imageUrl,
  hoverImageUrl,
  time,
  commercialType,
  className = "",
}) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const [hoverImageFailed, setHoverImageFailed] = React.useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(id);
  const resolvedSlug = slug || id;
  const hasPromotion =
    promotionalPrice !== null &&
    promotionalPrice !== undefined &&
    promotionalPrice >= 0 &&
    promotionalPrice < price;
  const effectivePrice = hasPromotion ? promotionalPrice : price;
  const formattedPrice = currency.format(effectivePrice);
  const formattedOriginalPrice = hasPromotion ? currency.format(price) : null;
  const discountPercent = hasPromotion ? Math.round(((price - promotionalPrice) / price) * 100) : 0;
  const showImage = Boolean(imageUrl) && !imageFailed;
  const showHoverImage = Boolean(hoverImageUrl) && !hoverImageFailed && hoverImageUrl !== imageUrl;
  const commercialLabel = commercialType ? COMMERCIAL_TYPE_LABELS[commercialType] : null;
  const metadata = [time?.trim() || null, commercialLabel].filter(Boolean).join(" · ");

  return (
    <article
      className={`group relative flex h-full flex-col bg-white outline-none ${className}`}
      data-product-card
    >
      <Link
        to="/product/$id"
        params={{ id: resolvedSlug }}
        aria-label={`Ver ${name}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
      />

      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl bg-[#f6f6f6]">
        {hasPromotion ? (
          <span className="absolute left-2.5 top-2.5 z-20 rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white sm:text-[10px]">
            -{discountPercent}%
          </span>
        ) : null}

        <button
          type="button"
          onClick={() =>
            toggleFavorite({
              id,
              slug: resolvedSlug,
              name,
              price,
              promotionalPrice,
              imageUrl,
              time,
              commercialType,
            })
          }
          className="absolute right-2.5 top-2.5 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-sm transition hover:scale-105 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 motion-reduce:transform-none motion-reduce:transition-none"
          aria-label={favorite ? `Remover ${name} dos favoritos` : `Adicionar ${name} aos favoritos`}
          aria-pressed={favorite}
        >
          <Heart className={`h-4.5 w-4.5 ${favorite ? "fill-red-600 text-red-600" : ""}`} />
        </button>

        {showImage ? (
          <>
            <img
              src={imageUrl ?? undefined}
              alt={name}
              loading="lazy"
              decoding="async"
              width={640}
              height={800}
              sizes="(max-width: 639px) 48vw, (max-width: 1023px) 31vw, 260px"
              onError={() => setImageFailed(true)}
              className={`h-full w-full object-contain p-1.5 transition duration-300 motion-reduce:transition-none sm:p-2 ${
                showHoverImage ? "md:group-hover:opacity-0" : "group-hover:scale-[1.025] motion-reduce:transform-none"
              }`}
            />
            {showHoverImage ? (
              <img
                src={hoverImageUrl ?? undefined}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                width={640}
                height={800}
                sizes="(max-width: 1023px) 1px, 260px"
                onError={() => setHoverImageFailed(true)}
                className="pointer-events-none absolute inset-0 hidden h-full w-full object-contain p-2 opacity-0 transition-opacity duration-300 md:block md:group-hover:opacity-100 motion-reduce:transition-none"
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center font-bold italic uppercase text-gray-300">
            <span className="text-lg font-black tracking-[-0.06em] text-red-500/20">
              {BRAND.shortMark}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pb-1 pt-3.5">
        {metadata ? (
          <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-[0.07em] text-gray-500 sm:text-[11px]">
            {metadata}
          </p>
        ) : null}

        <h2 className="line-clamp-2 min-h-[32px] text-[13px] font-semibold leading-[1.3] tracking-[-0.015em] text-gray-950 transition-colors group-hover:text-red-600 sm:min-h-[39px] sm:text-[15px]">
          {name}
        </h2>

        <div className="mt-auto pt-3">
          {formattedOriginalPrice ? (
            <span className="mb-0.5 block text-[10px] font-medium text-gray-400 line-through sm:text-xs">
              {formattedOriginalPrice}
            </span>
          ) : null}
          <span className="text-base font-black tracking-[-0.035em] text-gray-950 sm:text-xl">
            {formattedPrice}
          </span>
          <p className="mt-1 text-[10px] font-medium text-gray-500 sm:text-[11px]">Preço por peça</p>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
