"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealDirection = "left" | "right" | "up";

interface DirectionalRevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
  once?: boolean;
}

export default function DirectionalReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.42,
  distance = 12,
  className,
  once = true,
}: DirectionalRevealProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -5% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once]);

  const hiddenTransform =
    direction === "left"
      ? `translate3d(-${distance}px,0,0)`
      : direction === "right"
        ? `translate3d(${distance}px,0,0)`
        : `translate3d(0,${Math.max(6, distance * 0.65)}px,0)`;

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block transform-gpu transition-[transform,opacity] motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0)" : hiddenTransform,
        transitionDuration: `${duration}s`,
        transitionDelay: `${delay}s`,
        transitionTimingFunction: "cubic-bezier(.22,1,.36,1)",
      }}
    >
      {children}
    </span>
  );
}

export type { DirectionalRevealProps, RevealDirection };
