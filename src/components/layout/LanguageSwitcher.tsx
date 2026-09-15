import { useEffect } from "react";
import { ChevronDown, Languages } from "lucide-react";

import { LOCALE_META, SUPPORTED_LOCALES, type Locale, useI18n } from "@/i18n";

export function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { locale, setLocale, translateText } = useI18n();

  useEffect(() => {
    // The header renders customer-facing labels directly from the active React locale.
    // Keep the DOM fallback away from this subtree so a previous locale cannot be restored.
    document.querySelector<HTMLElement>(".glass-header")?.setAttribute("data-no-i18n", "true");
  }, []);

  return (
    <label
      data-language-switcher
      className={
        mobile
          ? "relative flex h-12 min-w-0 w-full items-center gap-2.5 rounded-2xl border border-border bg-background/80 px-3.5 shadow-sm backdrop-blur-sm"
          : "relative flex h-11 min-w-[150px] items-center gap-2 rounded-2xl border border-border bg-background/80 px-3 shadow-sm backdrop-blur-sm"
      }
    >
      <Languages className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
      <span className="sr-only">{translateText("Idioma")}</span>
      <select
        aria-label={translateText("Idioma")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className={
          mobile
            ? "h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-7 text-sm font-extrabold text-foreground outline-none"
            : "h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 text-xs font-extrabold text-foreground outline-none sm:text-sm"
        }
        dir="ltr"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code} data-no-i18n className="bg-background text-foreground">
            {LOCALE_META[code].nativeName}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </label>
  );
}
