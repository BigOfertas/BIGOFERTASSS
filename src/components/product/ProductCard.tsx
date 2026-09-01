import React from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      className={`group flex h-full flex-col rounded-md border border-gray-100 bg-white p-2 transition-all duration-300 hover:shadow-md sm:p-3 ${className}`}
    >
      <div className="relative mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden rounded-sm bg-gray-50 transition-colors duration-300 group-hover:bg-white">
        {showImage ? (
          <img
            src={imageUrl ?? undefined}
            alt={name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="px-4 text-center text-xs font-medium text-gray-400">
            Imagem indisponível
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <h2 className="mb-1 h-[28px] line-clamp-2 text-[11px] font-medium leading-tight text-gray-800 transition-colors group-hover:text-red-600 sm:mb-2 sm:h-[32px] sm:text-[13px]">
          {name}
        </h2>

        <div className="mb-2 mt-auto sm:mb-3">
          {formattedOriginalPrice ? (
            <span className="mr-2 text-[10px] font-medium text-gray-400 line-through sm:text-xs">
              {formattedOriginalPrice}
            </span>
          ) : null}
          <span className="text-sm font-extrabold tracking-tight text-gray-900 sm:text-lg">
            {formattedPrice}
          </span>
        </div>

        <Button
          asChild
          className="flex h-8 w-full items-center justify-center gap-1 rounded-sm bg-[#E60000] text-[10px] font-bold uppercase tracking-wider text-white transition-colors duration-300 hover:bg-black sm:h-10 sm:gap-2 sm:text-[11px]"
        >
          <Link to="/product/$id" params={{ id: slug || id }}>
            <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
            Ver detalhes
          </Link>
        </Button>
      </div>
    </article>
  );
};

export default ProductCard;
