import React from "react";
import { Link } from "@tanstack/react-router";

interface CategoryCardProps {
  name: string;
  image?: string;
  href: string;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ name, image, href }) => {
  return (
    <Link
      to={href}
      className="group flex flex-col items-center gap-2 min-w-[100px] sm:min-w-[140px] md:min-w-0 md:w-full"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-100 border border-gray-100 transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
            <span className="text-[10px] font-bold uppercase italic tracking-tighter opacity-20 text-red-600 sm:text-xs">
              BIG
            </span>
          </div>
        )}
      </div>
      <span className="text-center text-[10px] font-bold uppercase tracking-wide text-gray-900 transition-colors group-hover:text-red-600 sm:text-xs">
        {name}
      </span>
    </Link>
  );
};

export default CategoryCard;
