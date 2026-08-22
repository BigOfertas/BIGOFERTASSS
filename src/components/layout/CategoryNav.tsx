import React from "react";
import { Link } from "@tanstack/react-router";

const categories = [
  "INÍCIO",
  "COPA DO MUNDO",
  "RETRÔ",
  "JOGADOR",
  "KIT TREINO",
  "KIT REGATA",
  "CONJUNTOS",
  "INFANTIL",
  "FEMININAS",
  "ACESSÓRIOS",
];

const CategoryNav: React.FC = () => {
  return (
    <nav className="hidden md:block border-b border-gray-100 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="flex items-center justify-between py-3 overflow-x-auto no-scrollbar">
          {categories.map((category) => (
            <li key={category} className="flex-shrink-0">
              <Link
                to="/"
                className="text-xs font-bold text-black hover:text-red-600 transition-colors duration-200 whitespace-nowrap tracking-wider"
              >
                {category}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default CategoryNav;
