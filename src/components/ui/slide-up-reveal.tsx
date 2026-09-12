"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type SplitMode = "words" | "characters" | "lines";
type RevealOrigin = "first" | "last" | "center";

interface RevealTransition {
  duration?: number;
  delay?: number;
  ease?: string | number[];
}

interface SlideUpRevealProps {
  children: ReactNode;
  split?: SplitMode;
  delay?: number;
  stagger?: number;
  from?: RevealOrigin;
  transition?: RevealTransition;
  className?: string;
  wordClass?: string;
  charClass?: string;
  autoStart?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  inView?: boolean;
  once?: boolean;
}

export interface SlideUpRevealRef {
  startAnimation: () => void;
  reset: () => void;
}

interface WordObject {
  characters: string[];
  needsSpace: boolean;
}

function splitIntoCharacters(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), ({ segment }) => segment);
  }

  return Array.from(text);
}

function cssEase(ease: RevealTransition["ease"]) {
  if (Array.isArray(ease) && ease.length === 4) {
    return `cubic-bezier(${ease.join(",")})`;
  }
  return typeof ease === "string" ? ease : "cubic-bezier(.625,.05,0,1)";
}

const SlideUpReveal = forwardRef<SlideUpRevealRef, SlideUpRevealProps>(
  (
    {
      children,
      split = "words",
      delay = 0,
      stagger = 0.08,
      from = "first",
      transition = {
        ease: [0.625, 0.05, 0, 1],
        duration: 0.55,
      },
      className,
      wordClass,
      charClass,
      autoStart = true,
      onStart,
      onComplete,
      inView = false,
      once = true,
    },
    ref,
  ) => {
    const text = typeof children === "string" ? children : children?.toString() || "";
    const [isAnimating, setIsAnimating] = useState(false);
    const [hasCompleted, setHasCompleted] = useState(false);
    const rootRef = useRef<HTMLSpanElement | null>(null);

    const elements = useMemo(() => {
      const words = text.split(" ");
      if (split === "characters") {
        return words.map((word, index) => ({
          characters: splitIntoCharacters(word),
          needsSpace: index !== words.length - 1,
        }));
      }
      return split === "words" ? text.split(" ") : text.split("\n");
    }, [split, text]);

    const getStaggerDelay = useCallback(
      (index: number) => {
        const total =
          split === "characters"
            ? elements.reduce(
                (acc, word) =>
                  acc +
                  (typeof word === "string"
                    ? 1
                    : word.characters.length + (word.needsSpace ? 1 : 0)),
                0,
              )
            : elements.length;

        if (from === "last") return (total - 1 - index) * stagger;
        if (from === "center") {
          const center = Math.floor(total / 2);
          return Math.abs(center - index) * stagger;
        }
        return index * stagger;
      },
      [elements, from, split, stagger],
    );

    const startAnimation = useCallback(() => {
      if (once && hasCompleted) return;
      setIsAnimating(true);
      onStart?.();
    }, [hasCompleted, onStart, once]);

    const reset = useCallback(() => {
      if (once && hasCompleted) return;
      setIsAnimating(false);
    }, [hasCompleted, once]);

    useImperativeHandle(ref, () => ({ startAnimation, reset }), [reset, startAnimation]);

    useEffect(() => {
      if (typeof window === "undefined") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setIsAnimating(true);
        setHasCompleted(true);
        return;
      }

      if (!inView) {
        if (autoStart) startAnimation();
        return;
      }

      const node = rootRef.current;
      if (!node || typeof IntersectionObserver === "undefined") {
        startAnimation();
        return;
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            startAnimation();
            if (once) observer.disconnect();
          } else if (!once) {
            setIsAnimating(false);
          }
        },
        { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
      );

      observer.observe(node);
      return () => observer.disconnect();
    }, [autoStart, inView, once, startAnimation]);

    const duration = transition.duration ?? 0.55;
    const baseDelay = delay + (transition.delay ?? 0);
    const easing = cssEase(transition.ease);

    const animatedStyle = (index: number): CSSProperties => ({
      transform: isAnimating ? "translate3d(0,0,0)" : "translate3d(0,105%,0)",
      transitionProperty: "transform",
      transitionDuration: `${duration}s`,
      transitionTimingFunction: easing,
      transitionDelay: `${baseDelay + getStaggerDelay(index)}s`,
      willChange: isAnimating ? "transform" : undefined,
    });

    const normalizedWords: WordObject[] =
      split === "characters"
        ? (elements as WordObject[])
        : (elements as string[]).map((element, index, array) => ({
            characters: [element],
            needsSpace: split === "words" && index !== array.length - 1,
          }));

    const totalAnimatedUnits = normalizedWords.reduce(
      (sum, word) => sum + word.characters.length + (word.needsSpace ? 1 : 0),
      0,
    );
    const completionDelay = baseDelay + Math.max(0, totalAnimatedUnits - 1) * stagger + duration;

    useEffect(() => {
      if (!isAnimating || hasCompleted) return;
      const timeout = window.setTimeout(
        () => {
          setHasCompleted(true);
          onComplete?.();
        },
        Math.max(0, completionDelay * 1000),
      );
      return () => window.clearTimeout(timeout);
    }, [completionDelay, hasCompleted, isAnimating, onComplete]);

    return (
      <span
        ref={rootRef}
        className={cn(
          "flex flex-wrap whitespace-pre-wrap",
          split === "lines" && "flex-col",
          className,
        )}
      >
        <span className="sr-only">{text}</span>

        {normalizedWords.map((wordObj, wordIndex, array) => {
          const previousUnits = array
            .slice(0, wordIndex)
            .reduce((sum, word) => sum + word.characters.length + (word.needsSpace ? 1 : 0), 0);

          return (
            <span
              key={`${wordIndex}-${wordObj.characters.join("")}`}
              aria-hidden="true"
              className={cn("inline-flex overflow-hidden", wordClass)}
            >
              {wordObj.characters.map((char, charIndex) => (
                <span
                  key={`${charIndex}-${char}`}
                  className={cn("relative overflow-hidden whitespace-pre-wrap", charClass)}
                >
                  <span
                    className="inline-block transform-gpu motion-reduce:transform-none motion-reduce:transition-none"
                    style={animatedStyle(previousUnits + charIndex)}
                  >
                    {char}
                  </span>
                </span>
              ))}
              {wordObj.needsSpace ? (
                <span className="relative overflow-hidden" aria-hidden="true">
                  <span
                    className="inline-block transform-gpu motion-reduce:transform-none motion-reduce:transition-none"
                    style={animatedStyle(previousUnits + wordObj.characters.length)}
                  >
                    {" "}
                  </span>
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
    );
  },
);

SlideUpReveal.displayName = "SlideUpReveal";

export default SlideUpReveal;
export type { SlideUpRevealProps };
