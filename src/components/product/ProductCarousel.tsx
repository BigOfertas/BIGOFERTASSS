import React, { useState } from "react";

interface ProductCarouselProps {
  children: React.ReactNode;
  itemCount: number;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ children, itemCount }) => {
  const [activePage, setActivePage] = useState(0);
  const productsPerPage = 5;
  const products = React.Children.toArray(children);
  const pageCount = Math.max(1, Math.ceil(itemCount / productsPerPage));
  const visiblePage = Math.min(activePage, pageCount - 1);

  if (products.length === 0) {
    return null;
  }

  const pages = Array.from({ length: pageCount }, (_, index) =>
    products.slice(index * productsPerPage, (index + 1) * productsPerPage),
  );

  return (
    <div className="w-full">
      <div className="hidden md:block">
        <div className="relative">
          {pages.map((pageProducts, pageIndex) => (
            <div
              key={pageIndex}
              className={`grid grid-cols-5 gap-5 transition-opacity duration-300 ease-in-out ${
                visiblePage === pageIndex
                  ? "pointer-events-auto relative z-10 opacity-100"
                  : "pointer-events-none absolute left-0 top-0 z-0 w-full opacity-0"
              }`}
            >
              {pageProducts.map((child, index) => (
                <div key={index} className="w-full">
                  {child}
                </div>
              ))}
            </div>
          ))}
        </div>

        {pageCount > 1 ? (
          <div className="mt-10 flex items-center justify-center gap-4">
            {Array.from({ length: pageCount }).map((_, index) => (
              <button
                type="button"
                key={index}
                onClick={() => setActivePage(index)}
                aria-label={`Página ${index + 1}`}
                aria-current={visiblePage === index ? "page" : undefined}
                className={`h-3 w-3 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out ${
                  visiblePage === index
                    ? "scale-110 border-black bg-black"
                    : "border-black bg-white hover:bg-gray-100"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="md:hidden">
        <div className="custom-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth pb-4">
          {products.map((child, index) => (
            <div key={index} className="mb-2 w-[46%] flex-shrink-0 snap-start">
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductCarousel;
