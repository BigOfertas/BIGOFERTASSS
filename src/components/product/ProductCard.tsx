import React from "react";
import { Heart, Eye, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  className?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  price,
  imageUrl,
  className = "",
}) => {
  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);

  return (
    <div className={`group bg-white rounded-md border border-gray-100 p-2 sm:p-3 flex flex-col h-full transition-all duration-300 hover:shadow-md ${className}`}>
      {/* Product Image Container */}
      <div className="relative aspect-[4/5] mb-3 bg-gray-50 rounded-sm overflow-hidden flex items-center justify-center group-hover:bg-white transition-colors duration-300">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-contain mix-blend-multiply p-2 transform group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 font-bold italic text-lg uppercase">
            <span className="text-red-500/20">BIG</span>
          </div>
        )}

        {/* Overlay Actions (Prepared for Heart/Eye) */}
        <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-red-600 hover:border-red-600 transition-all">
            <Heart className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-red-600 hover:border-red-600 transition-all">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Content */}
      <div className="flex flex-col flex-1">
        <h3 className="text-[11px] sm:text-[13px] font-medium text-gray-800 mb-1 sm:mb-2 line-clamp-2 h-[28px] sm:h-[32px] leading-tight group-hover:text-red-600 transition-colors">
          {name}
        </h3>
        
        <div className="mt-auto mb-2 sm:mb-3">
          <span className="text-sm sm:text-lg font-extrabold text-gray-900 tracking-tight">
            {formattedPrice}
          </span>
        </div>

        <Button 
          asChild
          className="w-full bg-[#E60000] hover:bg-black text-white font-bold text-[10px] sm:text-[11px] uppercase tracking-wider h-8 sm:h-10 rounded-sm transition-colors duration-300 flex items-center justify-center gap-1 sm:gap-2"
        >
          <Link to="/product/$id" params={{ id }}>
            <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4" />
            VER DETALHES
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default ProductCard;