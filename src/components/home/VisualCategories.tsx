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
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 text-center sm:mb-10">
          <p className="display-kicker">Explore por estilo</p>
          <h2 className="display-title-sm mt-2">Monte um pedido do seu jeito</h2>
        </div>

        <div className="overflow-x-hidden overflow-y-hidden px-4 lg:px-8">
          <div className="animate-marquee category-marquee-track items-stretch">
            {[false, true].map((clone) => (
              <div
                key={clone ? "clone" : "original"}
                data-marquee-clone={clone ? "true" : undefined}
                className="flex shrink-0 items-stretch gap-3 pr-3 md:gap-5 md:pr-5"
              >
                {categories.map((category) => (
                  <div
                    key={`${clone ? "clone" : "original"}-${category.name}`}
                    className="h-[248px] w-[164px] shrink-0 md:h-[285px] md:w-[190px]"
                  >
                    <CategoryCard name={category.name} search={category.search} clone={clone} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-4 mt-7 h-px bg-gradient-to-r from-transparent via-gray-300/80 to-transparent md:mt-10 lg:mx-8" />
      </div>
    </section>
  );
};

export default VisualCategories;
