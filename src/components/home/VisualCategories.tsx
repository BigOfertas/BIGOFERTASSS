import React, { useRef, useState, useEffect } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Marquee loop for desktop (triplicated for seamless loop)
  const desktopCategories = [...categories, ...categories, ...categories];
  
  // Duplicated for infinite carousel on mobile
  const mobileCategories = [...categories, ...categories];

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    
    // Infinite loop logic for mobile
    if (scrollLeft <= 0) {
      scrollRef.current.scrollLeft = scrollWidth / 2;
    } else if (scrollLeft + clientWidth >= scrollWidth) {
      scrollRef.current.scrollLeft = scrollWidth / 2 - clientWidth;
    }

    const progress = scrollLeft / (scrollWidth - clientWidth);
    setScrollProgress(progress);
  };

  useEffect(() => {
    // Initial scroll position for mobile infinite loop
    if (scrollRef.current && window.innerWidth < 768) {
      const { scrollWidth } = scrollRef.current;
      scrollRef.current.scrollLeft = scrollWidth / 4;
    }
  }, []);

  return (
    <section className="py-8 sm:py-12 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <h2 className="mb-6 sm:mb-10 text-center text-lg sm:text-2xl font-black uppercase tracking-tight text-gray-900">
          Diversifique seu pedido
        </h2>
        
        {/* Desktop: Infinite Marquee Carousel */}
        <div className="hidden md:block relative group h-[180px] lg:h-[200px]">
          <div className="flex animate-marquee hover:[animation-play-state:paused] gap-6 items-center h-full">
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

        {/* Mobile: Infinite Carousel with Snap and Highlighted Progress Bar */}
        <div className="md:hidden">
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto pb-4 no-scrollbar gap-3 scroll-smooth snap-x h-[160px] items-center"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {mobileCategories.map((category, index) => (
              <div 
                key={index} 
                className="flex-shrink-0 w-[140px] h-[140px] snap-center"
              >
                <CategoryCard
                  name={category.name}
                  href={category.href}
                />
              </div>
            ))}
          </div>
          
          {/* Highlighted Progress Bar Indicator */}
          <div className="mt-4 h-[20px] w-full max-w-[200px] mx-auto bg-gray-100 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#dc2626] to-[#f97316] transition-all duration-300 ease-in-out"
              style={{ 
                width: '30%',
                transform: `translateX(${scrollProgress * (200 - 60)}px)` 
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default VisualCategories;
