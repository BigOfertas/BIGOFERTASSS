import React, { useState } from "react";

interface ProductCarouselProps {
  children: React.ReactNode;
  itemCount: number;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ children, itemCount }) => {
  const [activePage, setActivePage] = useState(0);
  const productsPerPage = 5;
  const pageCount = 3; // Fixed as requested: 3 bolinhas

  const products = React.Children.toArray(children);
  
  // Create groups of 5
  const pages = Array.from({ length: pageCount }, (_, i) => 
    products.slice(i * productsPerPage, (i + 1) * productsPerPage)
  );

  return (
    <div className="w-full">
      {/* Products Container with Crossfade */}
      <div className="relative min-h-[400px] md:min-h-[450px]">
        {pages.map((pageProducts, pageIndex) => (
          <div
            key={pageIndex}
            className={`absolute top-0 left-0 w-full transition-opacity duration-300 ease-in-out flex gap-4 md:gap-5 justify-center flex-wrap md:flex-nowrap ${
              activePage === pageIndex ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            {pageProducts.map((child, i) => (
              <div 
                key={i} 
                className="flex-shrink-0 w-[46%] sm:w-[45%] md:w-[calc((100%-80px)/5)]"
              >
                {child}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination Dots - Exactly 3, Small, Discrete, Centralized */}
      <div className="flex justify-center items-center gap-4 mt-8">
        {Array.from({ length: pageCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => setActivePage(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ease-in-out ${
              activePage === i ? "bg-black scale-110" : "bg-gray-200 hover:bg-gray-300"
            }`}
            aria-label={`Página ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ProductCarousel;