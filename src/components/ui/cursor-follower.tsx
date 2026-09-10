'use client';

import { useEffect, useRef, useState } from "react";

const INTERACTIVE_SELECTOR =
  'a, button, img, input, textarea, select, [role="button"], [data-cursor-interactive]';

export const Component = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const borderRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: -100, y: -100 });
  const dotPosition = useRef({ x: -100, y: -100 });
  const borderDotPosition = useRef({ x: -100, y: -100 });
  const animationFrame = useRef<number | null>(null);
  const hasPointerPosition = useRef(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!finePointer.matches) return;

    setEnabled(true);

    const dot = dotRef.current;
    const border = borderRef.current;
    if (!dot || !border) return;

    const setVisible = (visible: boolean) => {
      const opacity = visible ? "1" : "0";
      dot.style.opacity = opacity;
      border.style.opacity = opacity;
    };

    const setInteractive = (interactive: boolean) => {
      const size = interactive ? "44px" : "28px";
      border.style.width = size;
      border.style.height = size;
    };

    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;

      mousePosition.current = { x: event.clientX, y: event.clientY };

      if (!hasPointerPosition.current) {
        hasPointerPosition.current = true;
        dotPosition.current = { x: event.clientX, y: event.clientY };
        borderDotPosition.current = { x: event.clientX, y: event.clientY };
        dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
        border.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
      }

      setVisible(true);
    };

    const handlePointerOver = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (isInteractive(event.target)) setInteractive(true);
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      if (isInteractive(event.target) && !isInteractive(event.relatedTarget)) {
        setInteractive(false);
      }
    };

    const handleWindowOut = (event: MouseEvent) => {
      if (!event.relatedTarget) setVisible(false);
    };

    const lerp = (start: number, end: number, factor: number) =>
      start + (end - start) * factor;

    const animate = () => {
      if (hasPointerPosition.current) {
        dotPosition.current.x = lerp(dotPosition.current.x, mousePosition.current.x, 0.28);
        dotPosition.current.y = lerp(dotPosition.current.y, mousePosition.current.y, 0.28);
        borderDotPosition.current.x = lerp(
          borderDotPosition.current.x,
          mousePosition.current.x,
          0.14,
        );
        borderDotPosition.current.y = lerp(
          borderDotPosition.current.y,
          mousePosition.current.y,
          0.14,
        );

        dot.style.transform = `translate3d(${dotPosition.current.x}px, ${dotPosition.current.y}px, 0) translate(-50%, -50%)`;
        border.style.transform = `translate3d(${borderDotPosition.current.x}px, ${borderDotPosition.current.y}px, 0) translate(-50%, -50%)`;
      }

      animationFrame.current = window.requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    document.addEventListener("pointerout", handlePointerOut, { passive: true });
    window.addEventListener("mouseout", handleWindowOut, { passive: true });
    animationFrame.current = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("mouseout", handleWindowOut);
      if (animationFrame.current !== null) {
        window.cancelAnimationFrame(animationFrame.current);
      }
    };
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[10000] hidden md:block">
      <div
        ref={dotRef}
        className="absolute size-2 rounded-full bg-black opacity-0 will-change-transform dark:bg-white"
      />
      <div
        ref={borderRef}
        className="absolute size-7 rounded-full border border-black opacity-0 transition-[width,height,opacity] duration-300 will-change-transform dark:border-white"
      />
    </div>
  );
};
