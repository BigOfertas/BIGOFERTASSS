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
      data-visual-category-card
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
            sizes="(max-width: 767px) 164px, 328px"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full bg-gradient-to-br from-white via-gray-50 to-red-50/60"
          />
        )}
      </div>
    </Link>
  );
};

export default CategoryCard;
