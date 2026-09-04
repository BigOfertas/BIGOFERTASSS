import React, { useEffect, useRef, useState } from "react";

import CategoryCard from "./CategoryCard";

const categories = [
  { name: "Camisas de Times", search: { category: "camisas" } },
  { name: "Conjuntos Infantis / Kids", search: { category: "infantil" } },
  { name: "Shorts", search: { category: "shorts" } },
  { name: "Conjuntos / Kit de Treino", search: { category: "kit-treino" } },
  { name: "Basquete", search: { category: "basquete" } },
  { name: "Corta-Ventos", search: { category: "corta-ventos" } },
] as const;

const MOBILE_QUERY = "(max-width: 767px)";
const AUTO_LOOP_MS = 45_000;
const RESUME_DELAY_MS = 2_000;

function normalizeOffset(value: number, loopWidth: number) {
  if (loopWidth <= 0) return 0;

  let normalized = value % loopWidth;
  if (normalized > 0) normalized -= loopWidth;
  return normalized;
}

const VisualCategories: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const blockClickRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(media.matches);

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (!isMobile) {
      track.style.transform = "";
      offsetRef.current = 0;
      lastFrameRef.current = null;
      pausedRef.current = false;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      track.style.transform = "";
      return;
    }

    const tick = (time: number) => {
      const loopWidth = track.scrollWidth / 2;
      const previousTime = lastFrameRef.current;

      if (!pausedRef.current && previousTime !== null && loopWidth > 0) {
        const elapsed = Math.min(time - previousTime, 64);
        offsetRef.current = normalizeOffset(
          offsetRef.current - (loopWidth / AUTO_LOOP_MS) * elapsed,
          loopWidth,
        );
        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }

      lastFrameRef.current = time;
      frameRef.current = requestAnimationFrame(tick);
    };

    lastFrameRef.current = null;
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isMobile]);

  useEffect(
    () => () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
    },
    [],
  );

  const clearResumeTimer = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || event.pointerType === "mouse") return;

    clearResumeTimer();
    pausedRef.current = true;
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    dragStartXRef.current = event.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    blockClickRef.current = false;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Alguns navegadores móveis não oferecem captura de ponteiro aqui.
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      !isMobile ||
      !draggingRef.current ||
      pointerIdRef.current !== event.pointerId
    ) {
      return;
    }

    const track = trackRef.current;
    if (!track) return;

    const deltaX = event.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 6) blockClickRef.current = true;

    const loopWidth = track.scrollWidth / 2;
    if (loopWidth <= 0) return;

    offsetRef.current = normalizeOffset(
      dragStartOffsetRef.current + deltaX,
      loopWidth,
    );
    track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile || pointerIdRef.current !== event.pointerId) return;

    draggingRef.current = false;
    pointerIdRef.current = null;

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Sem ação: a interação já terminou.
    }

    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
      resumeTimerRef.current = null;
    }, RESUME_DELAY_MS);

    window.setTimeout(() => {
      blockClickRef.current = false;
    }, 0);
  };

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile || !blockClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    blockClickRef.current = false;
  };

  return (
    <section className="overflow-hidden bg-transparent py-10 md:py-14 lg:py-18">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 text-center sm:mb-10">
          <p className="display-kicker">Explore por estilo</p>
          <h2 className="display-title-sm mt-2">Monte um pedido do seu jeito</h2>
        </div>

        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClickCapture={handleClickCapture}
          className="overflow-x-hidden overflow-y-hidden px-4 lg:px-8"
          style={{ touchAction: "pan-y" }}
        >
          <div
            ref={trackRef}
            className="animate-marquee category-marquee-track items-stretch"
            style={{ animation: isMobile ? "none" : undefined }}
          >
            {[false, true].map((clone) => (
              <div
                key={clone ? "clone" : "original"}
                data-marquee-clone={clone ? "true" : undefined}
                className="flex shrink-0 items-stretch gap-3 pr-3 md:gap-5 md:pr-5"
              >
                {categories.map((category) => (
                  <div
                    key={`${clone ? "clone" : "original"}-${category.name}`}
                    className="h-[248px] w-[164px] shrink-0 md:h-[285px] md:w-[190px]"
                  >
                    <CategoryCard
                      name={category.name}
                      search={category.search}
                      clone={clone}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mx-4 mt-7 h-px bg-gradient-to-r from-transparent via-gray-300/80 to-transparent md:mt-10 lg:mx-8" />
      </div>
    </section>
  );
};

export default VisualCategories;
