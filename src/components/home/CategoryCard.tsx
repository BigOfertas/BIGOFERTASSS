import React from "react";
import { Link } from "@tanstack/react-router";

import { BRAND } from "@/config/brand";
import type { ProductSearchFilters } from "@/lib/products";

interface CategoryCardProps {
  name: string;
  image?: string;
  search: ProductSearchFilters;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ name, image, search }) => {
  return (
    <Link
      to="/products"
      search={search}
      className="glass-card group flex min-w-[100px] flex-col items-center gap-3 rounded-[1.4rem] p-2.5 sm:min-w-[140px] md:min-w-0 md:w-full"
    >
      <div className="glass-media relative aspect-[2/3] w-full overflow-hidden rounded-[1.05rem]">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-[-0.05em] text-red-600/20 sm:text-xs">
              {BRAND.shortMark}
            </span>
          </div>
        )}
      </div>
      <span className="min-h-8 px-1 text-center text-[10px] font-extrabold leading-tight tracking-[-0.015em] text-gray-900 transition-colors group-hover:text-red-600 sm:text-xs">
        {name}
      </span>
    </Link>
  );
};

export default CategoryCard;
