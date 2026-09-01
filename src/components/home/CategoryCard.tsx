import React from "react";
import { Link } from "@tanstack/react-router";

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
      className="group flex min-w-[100px] flex-col items-center gap-2 sm:min-w-[140px] md:w-full md:min-w-0"
    >
      <div className="relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="px-4 text-center text-sm font-black uppercase tracking-tight text-gray-700 transition-colors group-hover:text-red-600">
            {name}
          </span>
        )}
      </div>
      <span className="text-center text-[10px] font-bold uppercase tracking-wide text-gray-900 transition-colors group-hover:text-red-600 sm:text-xs">
        {name}
      </span>
    </Link>
  );
};

export default CategoryCard;
