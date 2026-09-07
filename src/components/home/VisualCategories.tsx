import React from "react";

import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";
import CategoryCard from "./CategoryCard";

const categories = [
  { name: "Conjunto infantil / Kids", search: { category: "infantil" }, slot: "category_kids" },
  {
    name: "Conjunto de treino / Kits",
    search: { category: "kit-treino" },
    slot: "category_training",
  },
  { name: "Short", search: { category: "shorts" }, slot: "category_shorts" },
  { name: "Basquete / NBA", search: { category: "basquete" }, slot: "category_basketball" },
  {
    name: "Corta-vento / Windbreaker",
    search: { category: "corta-ventos" },
    slot: "category_windbreaker",
  },
  { name: "Mundo FIFA", search: { campeonato: "copa-do-mundo" }, slot: "category_fifa" },
  { name: "Camisas retrô", search: { category: "retro" }, slot: "category_retro" },
] as const;

const VisualCategories: React.FC = () => {
  const { data: personalization } = useStorefrontPersonalization();

  return (
    <section className="overflow-hidden bg-transparent py-8 md:py-10 lg:py-12">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-6 text-center sm:mb-8">
          <p className="display-kicker">Explore por estilo</p>
          <h2 className="display-title-sm mt-2">Monte seu pedido</h2>
        </div>

        <div className="flex items-stretch gap-3 overflow-x-auto pb-4 no-scrollbar md:grid md:grid-cols-4 md:gap-4 md:overflow-x-visible md:pb-0 xl:grid-cols-7">
          {categories.map((category) => (
            <div
              key={category.name}
              className="h-[248px] w-[164px] flex-shrink-0 md:h-[330px] md:w-auto xl:h-[300px]"
            >
              <CategoryCard
                name={category.name}
                search={category.search}
                image={personalization?.[category.slot]?.url}
              />
            </div>
          ))}
        </div>

        <div className="mx-auto mt-7 h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent md:mt-8" />
      </div>
    </section>
  );
};

export default VisualCategories;
