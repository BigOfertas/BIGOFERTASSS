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
  {
    name: "COPA DO MUNDO",
    href: "/products",
    search: { campeonato: "copa-do-mundo" },
  },
  { name: "RETRÔ", href: "/products", search: { category: "retro" } },
  { name: "JOGADOR", href: "/products", search: { category: "jogador" } },
  {
    name: "KIT TREINO",
    href: "/products",
    search: { category: "kit-treino" },
  },
  {
    name: "KIT REGATA",
    href: "/products",
    search: { category: "kit-regata" },
  },
  {
    name: "CONJUNTOS",
    href: "/products",
    search: { category: "conjuntos" },
  },
  { name: "INFANTIL", href: "/products", search: { category: "infantil" } },
  { name: "FEMININAS", href: "/products", search: { category: "femininas" } },
  {
    name: "ACESSÓRIOS",
    href: "/products",
    search: { category: "acessorios" },
  },
];

interface CategoryNavProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

const CategoryNav: React.FC<CategoryNavProps> = ({
  mobile = false,
  onNavigate,
}) => {
  const location = useLocation();
  const currentSearch = location.search as ProductSearchFilters;

  return (
    <nav
      className={
        mobile
          ? "border-t border-gray-100 bg-white md:hidden"
          : "hidden md:block bg-white border-t border-gray-100"
      }
      aria-label="Categorias"
    >
      <div className={mobile ? "px-4 py-2" : "max-w-7xl mx-auto px-4 lg:px-8"}>
        <ul
          className={
            mobile
              ? "grid grid-cols-2 gap-1 py-2"
              : "flex items-center justify-between py-3 overflow-x-auto no-scrollbar"
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
              ? `rounded-md px-3 py-2 text-left whitespace-nowrap text-[12px] font-extrabold tracking-wider text-gray-900 transition-colors duration-200 hover:text-red-600 ${
                  isActive ? "text-red-600" : ""
                }`
              : `text-[12px] font-extrabold text-gray-900 hover:text-red-600 transition-colors duration-200 whitespace-nowrap tracking-wider py-1.5 px-0.5 relative group ${
                  isActive ? "text-red-600" : ""
                }`;

            const underline = mobile ? null : (
              <span
                className={`absolute -bottom-1 left-0 w-full h-0.5 bg-red-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left ${
                  isActive ? "scale-x-100" : ""
                }`}
              />
            );

            if (category.href === "/") {
              return (
                <li key={category.name} className="flex-shrink-0">
                  <Link to="/" onClick={onNavigate} className={className}>
                    {category.name}
                    {underline}
                  </Link>
                </li>
              );
            }

            return (
              <li key={category.name} className="flex-shrink-0">
                <Link
                  to="/products"
                  search={category.search ?? {}}
                  onClick={onNavigate}
                  className={className}
                >
                  {category.name}
                  {underline}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default CategoryNav;
