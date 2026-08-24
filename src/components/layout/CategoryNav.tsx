import React from "react";
import { Link, useLocation } from "@tanstack/react-router";

const categories = [
  { name: "INÍCIO", href: "/" },
  { name: "COPA DO MUNDO", href: "/products", search: { campeonato: "copa-do-mundo" } },
  { name: "RETRÔ", href: "/products", search: { category: "retro" } },
  { name: "JOGADOR", href: "/products", search: { category: "jogador" } },
  { name: "KIT TREINO", href: "/products", search: { category: "kit-treino" } },
  { name: "KIT REGATA", href: "/products", search: { category: "kit-regata" } },
  { name: "CONJUNTOS", href: "/products", search: { category: "conjuntos" } },
  { name: "INFANTIL", href: "/products", search: { category: "infantil" } },
  { name: "FEMININAS", href: "/products", search: { category: "femininas" } },
  { name: "ACESSÓRIOS", href: "/products", search: { category: "acessorios" } },
];

const CategoryNav: React.FC = () => {
  const location = useLocation();

  return (
    <nav className="hidden md:block bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <ul className="flex items-center justify-between py-3 overflow-x-auto no-scrollbar">
          {categories.map((category) => {
            const isActive = location.pathname === category.href;
            
            return (
              <li key={category.name} className="flex-shrink-0">
                <Link
                  to={category.href as any}
                  search={category.search as any}
                  className={`text-[12px] font-extrabold text-gray-900 hover:text-red-600 transition-colors duration-200 whitespace-nowrap tracking-wider py-1.5 px-0.5 relative group ${
                    isActive ? "text-red-600" : ""
                  }`}
                >
                  {category.name}
                  <span className={`absolute -bottom-1 left-0 w-full h-0.5 bg-red-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left ${
                    isActive ? "scale-x-100" : ""
                  }`}></span>
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
