import React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
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
}

const COMMERCIAL_TYPE_LABELS: Record<string, string> = {
  torcedor: "Torcedor",
  feminino: "Feminino",
  jogador: "Jogador",
  retro: "Retrô",
  infantil: "Infantil",
  calcao: "Calção",
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
  const commercialLabel = commercialType ? COMMERCIAL_TYPE_LABELS[commercialType] : null;
  const metadata = [commercialLabel, time?.trim() || null].filter(Boolean).join(" · ");

  return (
    <article
      className={`group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none sm:p-3 ${className}`}
    >
      <Link
        to="/product/$id"
        params={{ id: slug || id }}
        className="relative mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl bg-gray-50 sm:mb-4"
        aria-label={`Ver ${name}`}
      >
        {hasPromotion ? (
          <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white shadow-sm sm:text-[10px]">
            Oferta
          </span>
        ) : null}

        {showImage ? (
          <img
            src={imageUrl ?? undefined}
            alt={name}
            loading="lazy"
            decoding="async"
            width={640}
            height={800}
            sizes="(max-width: 639px) 46vw, (max-width: 1023px) 31vw, 260px"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain p-2.5 transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-bold italic uppercase text-gray-300">
            <span className="text-lg font-black tracking-[-0.06em] text-red-500/20">
              {BRAND.shortMark}
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-0.5 pb-0.5">
        {metadata ? (
          <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 sm:text-[11px]">
            {metadata}
          </p>
        ) : null}

        <Link to="/product/$id" params={{ id: slug || id }} className="group/title">
          <h2 className="mb-2 line-clamp-2 min-h-[30px] text-[12px] font-bold leading-[1.3] tracking-[-0.015em] text-gray-900 transition-colors group-hover/title:text-red-600 sm:min-h-[38px] sm:text-[14px]">
            {name}
          </h2>
        </Link>

        <div className="mb-3 mt-auto sm:mb-4">
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
          variant="outline"
          className="h-9 w-full rounded-xl border-gray-200 bg-white text-[10px] font-extrabold uppercase tracking-[0.08em] text-gray-900 hover:border-gray-950 hover:bg-gray-950 hover:text-white sm:h-10 sm:text-[11px]"
        >
          <Link to="/product/$id" params={{ id: slug || id }}>
            Ver produto
            <ArrowRight className="ml-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
};

export default ProductCard;
