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
  
  // Create groups of 5 for desktop pagination
  const pages = Array.from({ length: pageCount }, (_, i) => 
    products.slice(i * productsPerPage, (i + 1) * productsPerPage)
  );

  return (
    <div className="w-full">
      {/* Desktop Version: Crossfade + Dots (Hidden on mobile) */}
      <div className="hidden md:block">
        <div className="relative">
          {pages.map((pageProducts, pageIndex) => (
            <div
              key={pageIndex}
              className={`transition-opacity duration-300 ease-in-out grid grid-cols-5 gap-5 ${
                activePage === pageIndex 
                  ? "opacity-100 z-10 pointer-events-auto relative" 
                  : "opacity-0 z-0 pointer-events-none absolute top-0 left-0 w-full"
              }`}
            >
              {pageProducts.map((child, i) => (
                <div key={i} className="w-full">
                  {child}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Desktop Pagination Dots: 3 dots with border */}
        <div className="flex justify-center items-center gap-4 mt-10">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => setActivePage(i)}
              className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ease-in-out cursor-pointer ${
                activePage === i 
                  ? "bg-black border-black scale-110" 
                  : "bg-white border-black hover:bg-gray-100"
              }`}
              aria-label={`Página ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Mobile Version: Horizontal Scroll (Hidden on desktop) */}
      <div className="md:hidden">
        <div className="flex overflow-x-auto pb-4 gap-4 scroll-smooth snap-x custom-scrollbar">
          {products.map((child, index) => (
            <div 
              key={index} 
              className="flex-shrink-0 w-[46%] snap-start mb-2"
            >
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductCarousel;