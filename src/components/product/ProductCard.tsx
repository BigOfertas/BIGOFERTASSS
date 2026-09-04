import React from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";

interface ProductCardProps {
  id: string;
  slug?: string;
  name: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  className?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  slug,
  name,
  price,
  promotionalPrice,
  imageUrl,
  className = "",
}) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const currency = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const hasPromotion =
    promotionalPrice !== null &&
    promotionalPrice !== undefined &&
    promotionalPrice >= 0 &&
    promotionalPrice < price;
  const formattedPrice = currency.format(hasPromotion ? promotionalPrice : price);
  const formattedOriginalPrice = hasPromotion ? currency.format(price) : null;
  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <article
      className={`glass-card group flex h-full flex-col rounded-[1.35rem] p-2.5 sm:p-3.5 ${className}`}
    >
      <div className="glass-media relative mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[1rem] sm:mb-4">
        {hasPromotion ? (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-red-600 shadow-sm sm:text-[10px]">
            Oferta
          </span>
        ) : null}

        {showImage ? (
          <img
            src={imageUrl ?? undefined}
            alt={name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain p-2 mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-bold italic uppercase text-gray-300">
            <span className="text-lg font-black tracking-[-0.06em] text-red-500/20">
              {BRAND.shortMark}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-0.5 pb-0.5">
        <h2 className="mb-2 line-clamp-2 h-[30px] text-[12px] font-semibold leading-[1.25] tracking-[-0.015em] text-gray-800 transition-colors group-hover:text-red-600 sm:h-[38px] sm:text-[14px]">
          {name}
        </h2>

        <div className="mt-auto mb-3 sm:mb-4">
          {formattedOriginalPrice ? (
            <span className="mb-0.5 block text-[10px] font-semibold tracking-tight text-gray-400 line-through sm:text-xs">
              {formattedOriginalPrice}
            </span>
          ) : null}
          <span className="text-base font-black tracking-[-0.04em] text-gray-950 sm:text-xl">
            {formattedPrice}
          </span>
        </div>

        <Button
          asChild
          className="premium-action h-9 w-full rounded-xl text-[10px] font-extrabold uppercase tracking-[0.1em] hover:brightness-[0.96] sm:h-10 sm:text-[11px]"
        >
          <Link to="/product/$id" params={{ id: slug || id }}>
            <ShoppingCart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Ver detalhes
          </Link>
        </Button>
      </div>
    </article>
  );
};

export default ProductCard;
