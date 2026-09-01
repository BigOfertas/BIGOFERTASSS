import React from "react";

import CategoryCard from "./CategoryCard";

const categories = [
  { name: "Camisas de Times", search: { category: "camisas" } },
  { name: "Conjuntos Infantis / Kids", search: { category: "infantil" } },
  { name: "Shorts", search: { category: "shorts" } },
  { name: "Conjuntos / Kit de Treino", search: { category: "kit-treino" } },
  { name: "Basquete", search: { category: "basquete" } },
  { name: "Corta-Ventos", search: { category: "corta-ventos" } },
] as const;

const VisualCategories: React.FC = () => {
  return (
    <section className="py-8 md:py-12 lg:py-16 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-6 sm:mb-10 text-center text-lg sm:text-2xl font-black uppercase tracking-tight text-gray-900">
          Diversifique seu pedido
        </h2>

        <div className="flex md:grid md:grid-cols-6 overflow-x-auto md:overflow-x-visible pb-6 md:pb-0 no-scrollbar gap-3 md:gap-6 items-center scroll-smooth">
          {categories.map((category) => (
            <div
              key={category.name}
              className="flex-shrink-0 w-[160px] h-[240px] md:w-auto md:h-auto"
            >
              <CategoryCard name={category.name} search={category.search} />
            </div>
          ))}
        </div>

        <div className="w-full h-1 bg-gray-300 mt-6 md:mt-8" />
      </div>
    </section>
  );
};

export default VisualCategories;
