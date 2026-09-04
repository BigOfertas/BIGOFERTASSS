import * as React from "react";

import { cn } from "@/lib/utils";

type BlurIntensity = "sm" | "md" | "lg" | "xl";
type ShadowIntensity = "none" | "xs" | "sm" | "md" | "lg" | "xl";
type GlowIntensity = "none" | "xs" | "sm" | "md" | "lg" | "xl";

type LiquidGlassOwnProps = {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  interactive?: boolean;
  blurIntensity?: BlurIntensity;
  shadowIntensity?: ShadowIntensity;
  glowIntensity?: GlowIntensity;
  borderRadius?: string;
};

type LiquidGlassCardProps<T extends React.ElementType> = LiquidGlassOwnProps & {
  as?: T;
} & Omit<React.ComponentPropsWithoutRef<T>, keyof LiquidGlassOwnProps | "as">;

const blurValues: Record<BlurIntensity, string> = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
};

const shadowValues: Record<ShadowIntensity, string> = {
  none: "inset 0 0 0 rgba(255,255,255,0)",
  xs: "inset 1px 1px 1px rgba(255,255,255,.34), inset -1px -1px 1px rgba(255,255,255,.26)",
  sm: "inset 2px 2px 2px rgba(255,255,255,.38), inset -2px -2px 2px rgba(255,255,255,.28)",
  md: "inset 3px 3px 3px rgba(255,255,255,.44), inset -3px -3px 3px rgba(255,255,255,.3)",
  lg: "inset 4px 4px 4px rgba(255,255,255,.48), inset -4px -4px 4px rgba(255,255,255,.32)",
  xl: "inset 6px 6px 6px rgba(255,255,255,.52), inset -6px -6px 6px rgba(255,255,255,.34)",
};

const glowValues: Record<GlowIntensity, string> = {
  none: "0 5px 14px rgba(15,23,42,.05)",
  xs: "0 7px 18px rgba(15,23,42,.065), 0 0 14px rgba(255,255,255,.08)",
  sm: "0 10px 24px rgba(15,23,42,.075), 0 0 24px rgba(255,255,255,.12)",
  md: "0 14px 30px rgba(15,23,42,.085), 0 0 30px rgba(255,255,255,.15)",
  lg: "0 18px 38px rgba(15,23,42,.095), 0 0 38px rgba(255,255,255,.18)",
  xl: "0 22px 46px rgba(15,23,42,.105), 0 0 46px rgba(255,255,255,.22)",
};

/**
 * Liquid-glass surface for navigation and dashboard cards.
 *
 * The visual layering mirrors the supplied liquid-glass reference, but avoids
 * SVG turbulence/displacement and JavaScript drag physics. Those effects are
 * expensive on phones and are not appropriate for navigation controls. Motion
 * is handled with GPU-cheap transform/opacity transitions in CSS.
 */
export function LiquidGlassCard<T extends React.ElementType = "div">({
  as,
  children,
  className,
  active = false,
  interactive = false,
  blurIntensity = "xl",
  shadowIntensity = "md",
  glowIntensity = "sm",
  borderRadius = "32px",
  style,
  ...props
}: LiquidGlassCardProps<T>) {
  const Component = (as ?? "div") as React.ElementType;
  const liquidStyle = {
    "--liquid-radius": borderRadius,
    "--liquid-blur": blurValues[blurIntensity],
    "--liquid-inner-shadow": shadowValues[shadowIntensity],
    "--liquid-glow": glowValues[glowIntensity],
    ...(style as React.CSSProperties),
  } as React.CSSProperties;

  return (
    <Component
      className={cn(
        "liquid-glass-card",
        interactive && "liquid-glass-card--interactive",
        active && "liquid-glass-card--active",
        className,
      )}
      style={liquidStyle}
      {...props}
    >
      {children}
    </Component>
  );
}
