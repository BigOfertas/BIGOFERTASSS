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
      className={`group bg-white rounded-md border border-gray-100 p-2 sm:p-3 flex flex-col h-full transition-all duration-300 hover:shadow-md ${className}`}
    >
      <div className="relative aspect-[4/5] mb-3 bg-gray-50 rounded-sm overflow-hidden flex items-center justify-center group-hover:bg-white transition-colors duration-300">
        {showImage ? (
          <img
            src={imageUrl ?? undefined}
            alt={name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-contain mix-blend-multiply p-2 transform group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold italic text-lg uppercase">
            <span className="text-red-500/20">BIG</span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1">
        <h2 className="text-[11px] sm:text-[13px] font-medium text-gray-800 mb-1 sm:mb-2 line-clamp-2 h-[28px] sm:h-[32px] leading-tight group-hover:text-red-600 transition-colors">
          {name}
        </h2>

        <div className="mt-auto mb-2 sm:mb-3">
          {formattedOriginalPrice ? (
            <span className="mr-2 text-[10px] font-medium text-gray-400 line-through sm:text-xs">
              {formattedOriginalPrice}
            </span>
          ) : null}
          <span className="text-sm sm:text-lg font-extrabold text-gray-900 tracking-tight">
            {formattedPrice}
          </span>
        </div>

        <Button
          asChild
          className="w-full bg-[#E60000] hover:bg-black text-white font-bold text-[10px] sm:text-[11px] uppercase tracking-wider h-8 sm:h-10 rounded-sm transition-colors duration-300 flex items-center justify-center gap-1 sm:gap-2"
        >
          <Link to="/product/$id" params={{ id: slug || id }}>
            <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
            VER DETALHES
          </Link>
        </Button>
      </div>
    </article>
  );
};

export default ProductCard;
