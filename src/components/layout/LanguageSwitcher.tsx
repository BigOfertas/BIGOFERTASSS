import { Languages } from "lucide-react";

import { LOCALE_META, SUPPORTED_LOCALES, type Locale, useI18n } from "@/i18n";

export function LanguageSwitcher({ mobile = false }: { mobile?: boolean }) {
  const { locale, setLocale, translateText } = useI18n();

  return (
    <label
      className={
        mobile
          ? "flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-background/80 px-3 py-2"
          : "flex h-11 items-center gap-2 rounded-2xl border border-border bg-background/80 px-3"
      }
    >
      <Languages className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
      <span className="sr-only">{translateText("Idioma")}</span>
      <select
        aria-label={translateText("Idioma")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent text-xs font-extrabold text-foreground outline-none sm:text-sm"
        dir="ltr"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code} data-no-i18n className="bg-background text-foreground">
            {LOCALE_META[code].nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
