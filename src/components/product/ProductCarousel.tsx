import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductCarouselProps {
  children: React.ReactNode;
  itemCount: number;
  activePage?: number;
  onPageChange?: (page: number) => void;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ children, itemCount, activePage = 0, onPageChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
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

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      // No desktop mostramos 5, então scrollamos por bloco de 5 ou parcial
      const scrollAmount = direction === "left" ? -clientWidth : clientWidth;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="relative group/carousel">
      {/* Arrows removed per instructions to use dots for group navigation */}

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