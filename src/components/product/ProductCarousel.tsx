import React, { useCallback, useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useI18n } from "@/i18n";

interface ProductCarouselProps {
  children: React.ReactNode;
  itemCount: number;
}

const PRODUCTS_PER_PAGE = 5;
const AUTOPLAY_DELAY_MS = 7000;
const DESKTOP_TRANSITION_MS = 300;
const MOBILE_SCROLL_SETTLE_MS = 160;

const ProductCarousel: React.FC<ProductCarouselProps> = ({ children, itemCount }) => {
  const { translateText } = useI18n();
  const [activePage, setActivePage] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const isMobile = useIsMobile();
  const products = React.Children.toArray(children);
  const pageCount = Math.max(1, Math.ceil(itemCount / PRODUCTS_PER_PAGE));
  const visiblePage = Math.min(activePage, pageCount - 1);
  const mobileScrollerRef = useRef<HTMLDivElement>(null);
  const autoplayTimerRef = useRef<number | null>(null);
  const mobileSettleTimerRef = useRef<number | null>(null);
  const isPointerInteractingRef = useRef(false);
  const isPageVisibleRef = useRef(true);

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current !== null) {
      window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  const clearMobileSettleTimer = useCallback(() => {
    if (mobileSettleTimerRef.current !== null) {
      window.clearTimeout(mobileSettleTimerRef.current);
      mobileSettleTimerRef.current = null;
    }
  }, []);

  const canAutoplay = useCallback(() => {
    if (!isPageVisibleRef.current || isPointerInteractingRef.current) {
      return false;
    }

    if (isMobile) {
      const scroller = mobileScrollerRef.current;
      return Boolean(scroller && scroller.scrollWidth > scroller.clientWidth + 1);
    }

    return pageCount > 1;
  }, [isMobile, pageCount]);

  const advanceMobilePage = useCallback(() => {
    const scroller = mobileScrollerRef.current;
    if (!scroller) return false;

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    if (maxScrollLeft <= 1) return false;

    const atEnd = maxScrollLeft - scroller.scrollLeft <= 4;
    const nextLeft = atEnd
      ? 0
      : Math.min(maxScrollLeft, scroller.scrollLeft + scroller.clientWidth);

    scroller.scrollTo({
      left: nextLeft,
      behavior: atEnd || prefersReducedMotion ? "auto" : "smooth",
    });

    return true;
  }, [prefersReducedMotion]);

  const scheduleAutoplayRef = useRef<(extraDelayMs?: number) => void>(() => undefined);

  const scheduleAutoplay = useCallback(
    (extraDelayMs = 0) => {
      clearAutoplayTimer();

      if (!canAutoplay()) return;

      autoplayTimerRef.current = window.setTimeout(() => {
        autoplayTimerRef.current = null;

        if (!canAutoplay()) {
          scheduleAutoplayRef.current();
          return;
        }

        if (isMobile) {
          const didMove = advanceMobilePage();
          if (!didMove) scheduleAutoplayRef.current();
          return;
        }

        setActivePage((currentPage) => {
          const safePage = Math.min(currentPage, pageCount - 1);
          return (safePage + 1) % pageCount;
        });

        scheduleAutoplayRef.current(prefersReducedMotion ? 0 : DESKTOP_TRANSITION_MS);
      }, AUTOPLAY_DELAY_MS + extraDelayMs);
    },
    [advanceMobilePage, canAutoplay, clearAutoplayTimer, isMobile, pageCount, prefersReducedMotion],
  );

  scheduleAutoplayRef.current = scheduleAutoplay;

  const scheduleAfterMobileSettles = useCallback(() => {
    clearMobileSettleTimer();
    mobileSettleTimerRef.current = window.setTimeout(
      () => {
        mobileSettleTimerRef.current = null;
        scheduleAutoplayRef.current();
      },
      prefersReducedMotion ? 0 : MOBILE_SCROLL_SETTLE_MS,
    );
  }, [clearMobileSettleTimer, prefersReducedMotion]);

  const handleMobileScroll = useCallback(() => {
    clearAutoplayTimer();
    scheduleAfterMobileSettles();
  }, [clearAutoplayTimer, scheduleAfterMobileSettles]);

  const handlePageSelect = useCallback(
    (page: number) => {
      clearAutoplayTimer();
      clearMobileSettleTimer();
      setActivePage(page);
      scheduleAutoplayRef.current(prefersReducedMotion ? 0 : DESKTOP_TRANSITION_MS);
    },
    [clearAutoplayTimer, clearMobileSettleTimer, prefersReducedMotion],
  );

  const handlePointerDown = useCallback(() => {
    isPointerInteractingRef.current = true;
    clearAutoplayTimer();
    clearMobileSettleTimer();
  }, [clearAutoplayTimer, clearMobileSettleTimer]);

  const handlePointerEnd = useCallback(() => {
    if (!isPointerInteractingRef.current) return;
    isPointerInteractingRef.current = false;

    if (isMobile) {
      scheduleAfterMobileSettles();
      return;
    }

    scheduleAutoplayRef.current(prefersReducedMotion ? 0 : DESKTOP_TRANSITION_MS);
  }, [isMobile, prefersReducedMotion, scheduleAfterMobileSettles]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = document.visibilityState !== "hidden";
      clearAutoplayTimer();
      clearMobileSettleTimer();

      if (isPageVisibleRef.current) {
        scheduleAutoplayRef.current();
      }
    };

    isPageVisibleRef.current = document.visibilityState !== "hidden";
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clearAutoplayTimer, clearMobileSettleTimer]);

  useEffect(() => {
    scheduleAutoplay();

    return () => {
      clearAutoplayTimer();
      clearMobileSettleTimer();
    };
  }, [clearAutoplayTimer, clearMobileSettleTimer, scheduleAutoplay]);

  if (products.length === 0) {
    return null;
  }

  const pages = Array.from({ length: pageCount }, (_, index) =>
    products.slice(index * PRODUCTS_PER_PAGE, (index + 1) * PRODUCTS_PER_PAGE),
  );

  return (
    <div
      className="w-full"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="hidden md:block">
        <div className="relative">
          {pages.map((pageProducts, pageIndex) => (
            <div
              key={pageIndex}
              className={`grid grid-cols-5 gap-5 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
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
                data-product-carousel-dot
                onClick={() => handlePageSelect(index)}
                aria-label={`${translateText("Página")} ${index + 1}`}
                aria-current={visiblePage === index ? "page" : undefined}
                className={`h-3 w-3 cursor-pointer rounded-full border-2 transition-all duration-300 ease-in-out motion-reduce:transition-none ${
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
        <div
          ref={mobileScrollerRef}
          onScroll={handleMobileScroll}
          className="custom-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth pb-4 motion-reduce:scroll-auto"
        >
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
