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
    <section className="overflow-hidden bg-white py-8 md:py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="mb-6 text-center text-lg font-black uppercase tracking-tight text-gray-900 sm:mb-10 sm:text-2xl">
          Diversifique seu pedido
        </h2>

        <div className="flex items-center gap-3 overflow-x-auto pb-6 no-scrollbar scroll-smooth md:grid md:grid-cols-6 md:gap-6 md:overflow-x-visible md:pb-0">
          {categories.map((category) => (
            <div
              key={category.name}
              className="h-[240px] w-[160px] flex-shrink-0 md:h-auto md:w-auto"
            >
              <CategoryCard name={category.name} search={category.search} />
            </div>
          ))}
        </div>

        <div className="mt-6 h-1 w-full bg-gray-300 md:mt-8" />
      </div>
    </section>
  );
};

export default VisualCategories;
