import React from "react";
import { Link, useLocation } from "@tanstack/react-router";

import { matchesFilter, type ProductSearchFilters } from "@/lib/products";

interface CategoryLink {
  name: string;
  href: "/" | "/products";
  search?: ProductSearchFilters;
}

export const categoryLinks: CategoryLink[] = [
  { name: "INÍCIO", href: "/" },
  { name: "KIDS", href: "/products", search: { category: "infantil" } },
  {
    name: "KITS DE TREINO",
    href: "/products",
    search: { category: "kit-treino" },
  },
  { name: "SHORTS", href: "/products", search: { category: "shorts" } },
  {
    name: "BASQUETE / NBA",
    href: "/products",
    search: { category: "basquete" },
  },
  {
    name: "CORTA-VENTO",
    href: "/products",
    search: { category: "corta-ventos" },
  },
  {
    name: "MUNDO FIFA",
    href: "/products",
    search: { campeonato: "copa-do-mundo" },
  },
  {
    name: "CAMISAS RETRÔ",
    href: "/products",
    search: { category: "retro" },
  },
];

interface CategoryNavProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

const CategoryNav: React.FC<CategoryNavProps> = ({ mobile = false, onNavigate }) => {
  const location = useLocation();
  const currentSearch = location.search as ProductSearchFilters;

  return (
    <nav
      className={
        mobile
          ? "border-t border-gray-100 bg-white md:hidden"
          : "hidden border-t border-gray-100 bg-white md:block"
      }
      aria-label="Categorias"
    >
      <div className={mobile ? "px-4 py-2" : "mx-auto max-w-7xl px-4 lg:px-8"}>
        <ul
          className={
            mobile
              ? "grid grid-cols-2 gap-1 py-2"
              : "flex items-center justify-between gap-4 overflow-x-auto py-3 no-scrollbar"
          }
        >
          {categoryLinks.map((category) => {
            const isActive =
              category.href === "/"
                ? location.pathname === "/"
                : location.pathname === "/products" &&
                  Boolean(category.search) &&
                  Object.entries(category.search ?? {}).every(([key, value]) =>
                    matchesFilter(
                      typeof currentSearch[key as keyof ProductSearchFilters] === "string"
                        ? (currentSearch[key as keyof ProductSearchFilters] as string)
                        : undefined,
                      typeof value === "string" ? value : undefined,
                    ),
                  );

            const className = mobile
              ? `rounded-lg px-3 py-2.5 text-left text-[12px] font-extrabold tracking-wide transition-colors ${
                  isActive
                    ? "bg-red-50 text-red-600"
                    : "text-gray-900 hover:bg-gray-50 hover:text-red-600"
                }`
              : `group relative whitespace-nowrap px-0.5 py-1.5 text-[11px] font-extrabold tracking-[0.04em] transition-colors ${
                  isActive ? "text-red-600" : "text-gray-900 hover:text-red-600"
                }`;

            const underline = mobile ? null : (
              <span
                className={`absolute -bottom-1 left-0 h-0.5 w-full origin-left bg-red-600 transition-transform duration-200 ${
                  isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            );

            return (
              <li key={category.name} className="flex-shrink-0">
                {category.href === "/" ? (
                  <Link to="/" onClick={onNavigate} className={className}>
                    {category.name}
                    {underline}
                  </Link>
                ) : (
                  <Link
                    to="/products"
                    search={category.search ?? {}}
                    onClick={onNavigate}
                    className={className}
                  >
                    {category.name}
                    {underline}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default CategoryNav;
