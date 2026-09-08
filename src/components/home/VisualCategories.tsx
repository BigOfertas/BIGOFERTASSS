import React from "react";

import CategoryCard from "@/components/home/CategoryCard";
import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";

const categories = [
  {
    name: "Conjunto infantil / Kids",
    slot: "category_kids" as const,
    search: { category: "kids" },
  },
  {
    name: "Conjunto de treino / Kits",
    slot: "category_training" as const,
    search: { category: "kits-de-treino" },
  },
  {
    name: "Short",
    slot: "category_shorts" as const,
    search: { category: "shorts" },
  },
  {
    name: "Basquete / NBA",
    slot: "category_basketball" as const,
    search: { category: "basquete-nba" },
  },
  {
    name: "Corta-vento / Windbreaker",
    slot: "category_windbreaker" as const,
    search: { category: "corta-vento" },
  },
  {
    name: "Mundo FIFA",
    slot: "category_fifa" as const,
    search: { campeonato: "copa-do-mundo" },
  },
  {
    name: "Camisas retrô",
    slot: "category_retro" as const,
    search: { category: "camisas-retro" },
  },
] as const;

export default function VisualCategories() {
  const { data } = useStorefrontPersonalization();

  return (
    <section className="bg-transparent py-9 sm:py-11 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-8">
          <p className="display-kicker">Escolha seu estilo</p>
          <h2 className="display-title mt-2">Monte seu pedido</h2>
        </div>

        <div className="custom-scrollbar flex gap-4 overflow-x-auto pb-3 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:pb-0 xl:grid-cols-7">
          {categories.map((category) => (
            <div key={category.slot} className="aspect-[2/3] w-[164px] flex-shrink-0 md:w-auto">
              <CategoryCard
                name={category.name}
                image={data?.[category.slot]?.url ?? null}
                search={category.search}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
