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
  return (
    <section className="py-8 sm:py-12 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="mb-6 sm:mb-10 text-center text-lg sm:text-2xl font-black uppercase tracking-tight text-gray-900">
          Diversifique seu pedido
        </h2>
        
        {/* Carousel for mobile and desktop if they don't fit */}
        <div className="flex overflow-x-auto pb-4 no-scrollbar gap-4 md:gap-6 scroll-smooth snap-x justify-start md:justify-center">
          {categories.map((category, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 w-[53%] sm:w-[48%] md:w-[calc((100%-120px)/5.5)] lg:w-[calc((100%-150px)/6.5)] xl:w-[calc(900px/6)] snap-start"
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
