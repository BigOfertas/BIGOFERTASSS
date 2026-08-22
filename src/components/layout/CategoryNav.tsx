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
    <nav className="hidden md:block bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <ul className="flex items-center justify-between py-2 overflow-x-auto no-scrollbar">
          {categories.map((category) => (
            <li key={category} className="flex-shrink-0">
              <Link
                to="/"
                className={`text-[11px] font-bold text-gray-800 hover:text-red-600 transition-colors duration-200 whitespace-nowrap tracking-widest py-2 px-1 relative group ${
                  category === "INÍCIO" ? "text-red-600" : ""
                }`}
              >
                {category}
                <span className={`absolute bottom-0 left-0 w-full h-0.5 bg-red-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left ${
                  category === "INÍCIO" ? "scale-x-100" : ""
                }`}></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default CategoryNav;
