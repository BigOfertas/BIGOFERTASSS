"use client";

import { useEffect, useId, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const SwitchToggleThemeDemo = ({ className }: { className?: string }) => {
  const id = useId();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const setDarkMode = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  return (
    <div
      data-theme-toggle
      className={cn("group inline-flex items-center gap-2", className)}
      aria-busy={!mounted}
    >
      <button
        type="button"
        id={`${id}-light`}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDark && "text-foreground/50",
        )}
        aria-controls={id}
        aria-label="Usar modo claro"
        onClick={() => setDarkMode(false)}
      >
        <SunIcon className="size-4" aria-hidden="true" />
      </button>

      <Switch
        id={id}
        checked={isDark}
        disabled={!mounted}
        onCheckedChange={setDarkMode}
        aria-labelledby={`${id}-light ${id}-dark`}
        aria-label="Alternar entre modo escuro e claro"
        className="h-6 w-11 data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-zinc-300 dark:data-[state=unchecked]:bg-zinc-700 [&>span]:h-5 [&>span]:w-5 data-[state=checked]:[&>span]:translate-x-5"
      />

      <button
        type="button"
        id={`${id}-dark`}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          !isDark && "text-foreground/50",
        )}
        aria-controls={id}
        aria-label="Usar modo escuro"
        onClick={() => setDarkMode(true)}
      >
        <MoonIcon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export default SwitchToggleThemeDemo;
