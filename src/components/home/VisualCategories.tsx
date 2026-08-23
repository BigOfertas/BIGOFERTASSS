import React from "react";
import CategoryCard from "./CategoryCard";

const categories = [
  {
    name: "Camisas de Times",
    href: "/categoria/camisas-times",
  },
  {
    name: "Conjuntos Infantis / Kids",
    href: "/categoria/kids",
  },
  {
    name: "Shorts",
    href: "/categoria/shorts",
  },
  {
    name: "Conjuntos / Kit de Treino",
    href: "/categoria/kits-treino",
  },
  {
    name: "Basquete",
    href: "/categoria/basquete",
  },
  {
    name: "Corta-Ventos",
    href: "/categoria/corta-ventos",
  },
];

const VisualCategories: React.FC = () => {
  // Duplicar para o loop infinito no desktop
  const desktopCategories = [...categories, ...categories, ...categories];

  return (
    <section className="py-8 sm:py-12 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-6 sm:mb-10 text-center text-lg sm:text-2xl font-black uppercase tracking-tight text-gray-900">
          Diversifique seu pedido
        </h2>
        
        {/* Desktop: Infinite Marquee Carousel */}
        <div className="hidden md:block relative group">
          <div className="flex animate-marquee hover:[animation-play-state:paused] gap-6">
            {desktopCategories.map((category, index) => (
              <div 
                key={index} 
                className="flex-shrink-0 w-[260px]"
              >
                <CategoryCard
                  name={category.name}
                  href={category.href}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: Standard Horizontal Swipe */}
        <div className="md:hidden flex overflow-x-auto pb-4 no-scrollbar gap-4 scroll-smooth snap-x">
          {categories.map((category, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 w-[53%] snap-start"
            >
              <CategoryCard
                name={category.name}
                href={category.href}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VisualCategories;
