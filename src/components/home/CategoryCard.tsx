import React from "react";
import { Link } from "@tanstack/react-router";

import type { ProductSearchFilters } from "@/lib/products";

interface CategoryCardProps {
  name: string;
  image?: string | null;
  search: ProductSearchFilters;
  clone?: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ name, image, search, clone = false }) => {
  return (
    <Link
      to="/products"
      search={search}
      aria-label={`Ver ${name}`}
      aria-hidden={clone || undefined}
      tabIndex={clone ? -1 : undefined}
      className="group block h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="relative h-full w-full overflow-hidden bg-gray-50">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            decoding="async"
            width={800}
            height={1200}
            sizes="(max-width: 767px) 164px, (max-width: 1279px) 25vw, 14vw"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-white via-gray-50 to-red-50/60" />
        )}
        <span className="absolute inset-x-3 bottom-3 rounded-xl bg-black/72 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-white backdrop-blur-sm">
          {name}
        </span>
      </div>
    </Link>
  );
};

export default CategoryCard;
