import React, { useRef, useState, useEffect } from "react";

interface ProductCarouselProps {
  children: React.ReactNode;
  itemCount: number;
  activePage?: number;
  onPageChange?: (page: number) => void;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ children, itemCount, activePage = 0, onPageChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setCanScrollLeft] = useState(false);
  const [, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
      
      // Update page state if scrolled manually (mobile swipe)
      if (onPageChange) {
        const page = Math.round(scrollLeft / clientWidth);
        if (page !== activePage && page >= 0 && page < 2) {
          onPageChange(page);
        }
      }
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [children]);

  useEffect(() => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      scrollRef.current.scrollTo({ left: activePage * clientWidth, behavior: "smooth" });
    }
  }, [activePage]);

  return (
    <div className="relative group/carousel">
      {/* Carousel Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex overflow-x-auto overflow-y-hidden no-scrollbar snap-x snap-mandatory gap-4 md:gap-5 pb-0 scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {React.Children.map(children, (child) => (
          <div className="flex-shrink-0 w-[80%] sm:w-[45%] md:w-[calc((100%-80px)/5)] snap-start">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductCarousel;