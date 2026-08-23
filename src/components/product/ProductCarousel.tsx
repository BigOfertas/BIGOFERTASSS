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
      {/* Products Container with Crossfade - Only Opacity changes */}
      <div className="relative">
        {pages.map((pageProducts, pageIndex) => (
          <div
            key={pageIndex}
            className={`transition-opacity duration-300 ease-in-out grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-6 md:gap-5 ${
              activePage === pageIndex 
                ? "opacity-100 z-10 pointer-events-auto relative" 
                : "opacity-0 z-0 pointer-events-none absolute top-0 left-0 w-full"
            }`}
          >
            {pageProducts.map((child, i) => (
              <div 
                key={i} 
                className="w-full"
              >
                {child}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pagination Dots - Exactly 3, Small, Discrete, Centralized */}
      <div className="flex justify-center items-center gap-4 mt-10">
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