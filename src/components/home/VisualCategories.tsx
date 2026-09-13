import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useRef } from "react";

import CategoryCard from "@/components/home/CategoryCard";
import DirectionalReveal from "@/components/ui/directional-reveal";
import SlideUpReveal from "@/components/ui/slide-up-reveal";
import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";

const categories = [
  {
    name: "Conjunto infantil / Kids",
    slot: "category_kids" as const,
    search: { category: "infantil" },
  },
  {
    name: "Conjunto de treino / Kits",
    slot: "category_training" as const,
    search: { category: "kit-treino" },
  },
  {
    name: "Short",
    slot: "category_shorts" as const,
    search: { category: "shorts" },
  },
  {
    name: "Basquete / NBA",
    slot: "category_basketball" as const,
    search: { category: "basquete" },
  },
  {
    name: "Corta-vento / Windbreaker",
    slot: "category_windbreaker" as const,
    search: { category: "corta-ventos" },
  },
  {
    name: "Mundo FIFA",
    slot: "category_fifa" as const,
    search: { campeonato: "copa-do-mundo" },
  },
  {
    name: "Camisas retrô",
    slot: "category_retro" as const,
    search: { category: "retro" },
  },
] as const;

export default function VisualCategories() {
  const { data } = useStorefrontPersonalization();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const moveOneCard = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    const firstCard = scroller?.querySelector<HTMLElement>("[data-category-slide]");
    if (!scroller || !firstCard) return;

    const styles = window.getComputedStyle(scroller);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    scroller.scrollBy({
      left: direction * (firstCard.offsetWidth + gap),
      behavior: "smooth",
    });
  };

  return (
    <section className="bg-transparent py-9 sm:py-11 lg:py-14">
      <div className="mx-auto max-w-[1800px] px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-8">
          <p className="display-kicker">
            <DirectionalReveal direction="up" distance={9}>
              Escolha seu estilo
            </DirectionalReveal>
          </p>
          <h2 className="display-title mt-2" style={{ animation: "none" }}>
            <SlideUpReveal split="characters" stagger={0.028} inView className="justify-center">
              Monte seu pedido
            </SlideUpReveal>
          </h2>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => moveOneCard(-1)}
            aria-label="Ver categoria anterior"
            className="category-carousel-arrow absolute left-2 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-600 bg-white/90 text-red-600 shadow-lg transition-[transform,background-color,color,box-shadow] duration-200 hover:-translate-y-1/2 hover:scale-105 hover:bg-red-600 hover:text-white hover:shadow-xl active:scale-95 md:flex motion-reduce:transition-none"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
          </button>

          <div
            ref={scrollerRef}
            className="custom-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth pb-3 md:gap-6 md:px-16 md:pb-4"
          >
            {categories.map((category) => (
              <div
                key={category.slot}
                data-category-slide
                className="aspect-[2/3] w-[164px] flex-shrink-0 snap-start md:w-[328px]"
              >
                <CategoryCard
                  name={category.name}
                  image={data?.[category.slot]?.url ?? null}
                  search={category.search}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => moveOneCard(1)}
            aria-label="Ver próxima categoria"
            className="category-carousel-arrow absolute right-2 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-600 bg-white/90 text-red-600 shadow-lg transition-[transform,background-color,color,box-shadow] duration-200 hover:-translate-y-1/2 hover:scale-105 hover:bg-red-600 hover:text-white hover:shadow-xl active:scale-95 md:flex motion-reduce:transition-none"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
