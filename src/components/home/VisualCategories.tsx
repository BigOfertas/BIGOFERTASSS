import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";

import CategoryCard from "@/components/home/CategoryCard";
import DirectionalReveal from "@/components/ui/directional-reveal";
import SlideUpReveal from "@/components/ui/slide-up-reveal";
import { useStorefrontPersonalization } from "@/hooks/useStorefrontPersonalization";

const categories = [
  {
    name: "Conjunto infantil / Kids",
    slot: "category_kids" as const,
    search: { category: "infantil" },
  },
  {
    name: "Conjunto de treino / Kits",
    slot: "category_training" as const,
    search: { category: "kit-treino" },
  },
  {
    name: "Short",
    slot: "category_shorts" as const,
    search: { category: "shorts" },
  },
  {
    name: "Basquete / NBA",
    slot: "category_basketball" as const,
    search: { category: "basquete" },
  },
  {
    name: "Corta-vento / Windbreaker",
    slot: "category_windbreaker" as const,
    search: { category: "corta-ventos" },
  },
  {
    name: "Mundo FIFA",
    slot: "category_fifa" as const,
    search: { campeonato: "copa-do-mundo" },
  },
  {
    name: "Camisas retrô",
    slot: "category_retro" as const,
    search: { category: "retro" },
  },
] as const;

const LOOP_COPIES = 3;
const CONTINUOUS_SPEED_PX_PER_SECOND = 20;
const HOVER_RESUME_DELAY_MS = 5000;
const MANUAL_INTERACTION_SETTLE_MS = 700;

export default function VisualCategories() {
  const { data } = useStorefrontPersonalization();
  const carouselAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const sequenceWidthRef = useRef(0);
  const isHoverPausedRef = useRef(false);
  const isPointerInteractingRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const normalizeLoopPosition = useCallback(() => {
    const scroller = scrollerRef.current;
    const sequenceWidth = sequenceWidthRef.current;
    if (!scroller || sequenceWidth <= 0) return;

    const middleStartCard = scroller.querySelector<HTMLElement>('[data-loop-copy="1"]');
    if (!middleStartCard) return;

    const middleStart = middleStartCard.offsetLeft;
    const middleEnd = middleStart + sequenceWidth;

    while (scroller.scrollLeft >= middleEnd) {
      scroller.scrollLeft -= sequenceWidth;
    }
    while (scroller.scrollLeft < middleStart) {
      scroller.scrollLeft += sequenceWidth;
    }
  }, []);

  const scheduleResumeAfterInteraction = useCallback(
    (delayMs = MANUAL_INTERACTION_SETTLE_MS) => {
      clearResumeTimer();
      if (prefersReducedMotionRef.current) {
        isPointerInteractingRef.current = false;
        normalizeLoopPosition();
        return;
      }
      if (isHoverPausedRef.current) return;

      resumeTimerRef.current = window.setTimeout(() => {
        resumeTimerRef.current = null;
        isPointerInteractingRef.current = false;
        normalizeLoopPosition();
        lastFrameTimeRef.current = null;
      }, delayMs);
    },
    [clearResumeTimer, normalizeLoopPosition],
  );

  const moveOneCard = useCallback(
    (direction: -1 | 1) => {
      const scroller = scrollerRef.current;
      const firstCard = scroller?.querySelector<HTMLElement>('[data-loop-copy="1"]');
      if (!scroller || !firstCard) return;

      clearResumeTimer();
      isPointerInteractingRef.current = true;
      const styles = window.getComputedStyle(scroller);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      scroller.scrollBy({
        left: direction * (firstCard.offsetWidth + gap),
        behavior: prefersReducedMotionRef.current ? "auto" : "smooth",
      });
      scheduleResumeAfterInteraction();
    },
    [clearResumeTimer, scheduleResumeAfterInteraction],
  );

  useEffect(() => {
    const carouselArea = carouselAreaRef.current;
    const scroller = scrollerRef.current;
    if (!carouselArea || !scroller) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    const syncReducedMotion = () => {
      prefersReducedMotionRef.current = reducedMotionQuery.matches;
      lastFrameTimeRef.current = null;
    };

    const measureLoop = () => {
      const firstCopy = scroller.querySelector<HTMLElement>('[data-loop-copy="0"]');
      const middleCopy = scroller.querySelector<HTMLElement>('[data-loop-copy="1"]');
      if (!firstCopy || !middleCopy) return;

      const sequenceWidth = middleCopy.offsetLeft - firstCopy.offsetLeft;
      if (sequenceWidth <= 0) return;

      sequenceWidthRef.current = sequenceWidth;
      if (scroller.scrollLeft < middleCopy.offsetLeft - 1) {
        scroller.scrollLeft = middleCopy.offsetLeft;
      } else {
        normalizeLoopPosition();
      }
    };

    const handleMouseEnter = () => {
      if (!hoverQuery.matches) return;
      clearResumeTimer();
      isHoverPausedRef.current = true;
      lastFrameTimeRef.current = null;
    };

    const handleMouseLeave = () => {
      if (!hoverQuery.matches) return;
      clearResumeTimer();
      isHoverPausedRef.current = true;
      resumeTimerRef.current = window.setTimeout(() => {
        resumeTimerRef.current = null;
        isHoverPausedRef.current = false;
        isPointerInteractingRef.current = false;
        normalizeLoopPosition();
        lastFrameTimeRef.current = null;
      }, HOVER_RESUME_DELAY_MS);
    };

    const handlePointerDown = () => {
      clearResumeTimer();
      isPointerInteractingRef.current = true;
      lastFrameTimeRef.current = null;
    };

    const handlePointerEnd = () => {
      normalizeLoopPosition();
      if (isHoverPausedRef.current && hoverQuery.matches) return;
      scheduleResumeAfterInteraction();
    };

    const animate = (time: number) => {
      if (
        !prefersReducedMotionRef.current &&
        !isHoverPausedRef.current &&
        !isPointerInteractingRef.current &&
        sequenceWidthRef.current > 0
      ) {
        if (lastFrameTimeRef.current !== null) {
          const deltaSeconds = Math.min((time - lastFrameTimeRef.current) / 1000, 0.05);
          scroller.scrollLeft += CONTINUOUS_SPEED_PX_PER_SECOND * deltaSeconds;
          normalizeLoopPosition();
        }
        lastFrameTimeRef.current = time;
      } else {
        lastFrameTimeRef.current = null;
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    syncReducedMotion();
    measureLoop();
    const resizeObserver = new ResizeObserver(measureLoop);
    resizeObserver.observe(scroller);
    reducedMotionQuery.addEventListener("change", syncReducedMotion);
    carouselArea.addEventListener("mouseenter", handleMouseEnter);
    carouselArea.addEventListener("mouseleave", handleMouseLeave);
    scroller.addEventListener("pointerdown", handlePointerDown);
    scroller.addEventListener("pointerup", handlePointerEnd);
    scroller.addEventListener("pointercancel", handlePointerEnd);
    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      clearResumeTimer();
      resizeObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
      carouselArea.removeEventListener("mouseenter", handleMouseEnter);
      carouselArea.removeEventListener("mouseleave", handleMouseLeave);
      scroller.removeEventListener("pointerdown", handlePointerDown);
      scroller.removeEventListener("pointerup", handlePointerEnd);
      scroller.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [clearResumeTimer, normalizeLoopPosition, scheduleResumeAfterInteraction]);

  return (
    <section className="bg-transparent py-9 sm:py-11 lg:py-14">
      <div className="mx-auto max-w-[1800px] px-4 lg:px-8">
        <div className="mb-7 text-center sm:mb-8">
          <p className="display-kicker">
            <DirectionalReveal direction="up" distance={9}>
              Escolha seu estilo
            </DirectionalReveal>
          </p>
          <h2 className="display-title mt-2" style={{ animation: "none" }}>
            <SlideUpReveal split="characters" stagger={0.028} inView className="justify-center">
              Monte seu pedido
            </SlideUpReveal>
          </h2>
        </div>

        <div ref={carouselAreaRef} className="relative">
          <button
            type="button"
            onClick={() => moveOneCard(-1)}
            aria-label="Ver categoria anterior"
            className="category-carousel-arrow absolute left-2 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-600 bg-white/90 text-red-600 shadow-lg transition-[transform,background-color,color,box-shadow] duration-200 hover:-translate-y-1/2 hover:scale-105 hover:bg-red-600 hover:text-white hover:shadow-xl active:scale-95 md:flex motion-reduce:transition-none"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
          </button>

          <div
            ref={scrollerRef}
            data-visual-categories-loop
            className="flex gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] md:gap-6 md:px-16 md:pb-4 [&::-webkit-scrollbar]:hidden"
          >
            {Array.from({ length: LOOP_COPIES }, (_, copyIndex) =>
              categories.map((category) => (
                <div
                  key={`${copyIndex}-${category.slot}`}
                  data-category-slide
                  data-loop-copy={copyIndex}
                  className="aspect-[2/3] w-[164px] flex-shrink-0 md:w-[328px]"
                >
                  <CategoryCard
                    name={category.name}
                    image={data?.[category.slot]?.url ?? null}
                    search={category.search}
                    clone={copyIndex !== 1}
                  />
                </div>
              )),
            )}
          </div>

          <button
            type="button"
            onClick={() => moveOneCard(1)}
            aria-label="Ver próxima categoria"
            className="category-carousel-arrow absolute right-2 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-600 bg-white/90 text-red-600 shadow-lg transition-[transform,background-color,color,box-shadow] duration-200 hover:-translate-y-1/2 hover:scale-105 hover:bg-red-600 hover:text-white hover:shadow-xl active:scale-95 md:flex motion-reduce:transition-none"
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
