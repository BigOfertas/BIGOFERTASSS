"use client";

import { FC, type ButtonHTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  variant?: "primary" | "secondary";
  classes?: string;
  animate?: boolean;
  delay?: number;
  loading?: boolean;
}

const MotionButton: FC<Props> = ({ label, classes, loading = false, disabled, ...buttonProps }) => {
  return (
    <button
      {...buttonProps}
      data-motion-button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "bg-background group relative h-auto w-50 cursor-pointer rounded-full border-[none] p-1 outline-none disabled:cursor-not-allowed disabled:opacity-50",
        classes,
      )}
    >
      <span
        className="circle bg-[var(--brand-accent)] m-0 block h-12 w-12 overflow-hidden rounded-full duration-500 group-hover:w-full group-disabled:w-12"
        aria-hidden="true"
      ></span>
      <div className="icon absolute top-1/2 left-4 translate-x-0 -translate-y-1/2 duration-500 group-hover:translate-x-[0.4rem] group-disabled:translate-x-0">
        <ArrowRight className="text-background size-6" />
      </div>
      <span className="button-text text-foreground group-hover:text-background font-manrope absolute top-2/4 left-2/4 ml-4 -translate-x-2/4 -translate-y-2/4 text-center text-lg font-medium tracking-tight whitespace-nowrap duration-500 group-disabled:text-foreground">
        {label}
      </span>
    </button>
  );
};

export default MotionButton;
