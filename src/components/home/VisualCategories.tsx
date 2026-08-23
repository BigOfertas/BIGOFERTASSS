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
    <section className="py-8 sm:py-12 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-6 sm:mb-10 text-center text-lg sm:text-2xl font-black uppercase tracking-tight text-gray-900">
          Diversifique seu pedido
        </h2>
        
        {/* Carousel for mobile and desktop */}
        <div className="flex overflow-x-auto pb-4 no-scrollbar gap-4 md:gap-6 scroll-smooth snap-x justify-start md:justify-center">
          {categories.map((category, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 w-[53%] sm:w-[48%] md:w-[23%] lg:w-[20%] xl:w-[260px] snap-start"
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
