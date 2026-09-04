import React from "react";
import { Link } from "@tanstack/react-router";

import type { ProductSearchFilters } from "@/lib/products";

interface CategoryCardProps {
  name: string;
  image?: string;
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
      className="glass-card group block h-full w-full overflow-hidden rounded-[1.4rem]"
    >
      <div className="glass-media relative h-full w-full overflow-hidden rounded-[1.3rem]">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
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
