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
          ESCOLHA SUA CATEGORIA
        </h2>
        
        {/* Carousel for mobile, Grid for desktop */}
        <div className="flex overflow-x-auto pb-4 no-scrollbar gap-3 sm:gap-4 md:grid md:grid-cols-6 md:pb-0 scroll-smooth snap-x">
          {categories.map((category, index) => (
            <div key={index} className="flex-shrink-0 w-[28%] sm:w-[22%] md:w-full snap-start">
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
