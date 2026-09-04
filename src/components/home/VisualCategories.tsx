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
    <section className="overflow-hidden bg-transparent py-10 md:py-14 lg:py-18">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-10">
          <p className="display-kicker">Explore por estilo</p>
          <h2 className="display-title-sm mt-2">Monte um pedido do seu jeito</h2>
        </div>

        <div className="flex items-stretch gap-3 overflow-x-auto pb-5 no-scrollbar md:grid md:grid-cols-6 md:gap-5 md:overflow-x-visible md:pb-0">
          {categories.map((category) => (
            <div
              key={category.name}
              className="h-[248px] w-[164px] flex-shrink-0 md:h-auto md:w-auto"
            >
              <CategoryCard name={category.name} search={category.search} />
            </div>
          ))}
        </div>

        <div className="mx-auto mt-7 h-px w-full bg-gradient-to-r from-transparent via-gray-300/80 to-transparent md:mt-10" />
      </div>
    </section>
  );
};

export default VisualCategories;
