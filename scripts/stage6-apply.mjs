import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

async function read(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), "utf8");
}

async function write(relativePath, content) {
  const target = path.join(ROOT, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

function replaceRequired(content, needle, replacement, label) {
  if (!content.includes(needle)) {
    throw new Error(`Stage 6 patch failed (${label}): expected source was not found.`);
  }
  return content.replace(needle, replacement);
}

const i18nIndex = String.raw`import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const SUPPORTED_LOCALES = [
  "pt",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "nl",
  "ja",
  "ko",
  "zh",
  "ar",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type TextDirection = "ltr" | "rtl";

type Catalog = Record<string, string>;

type LocaleMeta = {
  htmlLang: string;
  nativeName: string;
  direction: TextDirection;
  ogLocale: string;
};

export const LOCALE_STORAGE_KEY = "dropbox-locale";

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  pt: { htmlLang: "pt-BR", nativeName: "Português", direction: "ltr", ogLocale: "pt_BR" },
  en: { htmlLang: "en", nativeName: "English", direction: "ltr", ogLocale: "en_US" },
  es: { htmlLang: "es", nativeName: "Español", direction: "ltr", ogLocale: "es_ES" },
  fr: { htmlLang: "fr", nativeName: "Français", direction: "ltr", ogLocale: "fr_FR" },
  de: { htmlLang: "de", nativeName: "Deutsch", direction: "ltr", ogLocale: "de_DE" },
  it: { htmlLang: "it", nativeName: "Italiano", direction: "ltr", ogLocale: "it_IT" },
  nl: { htmlLang: "nl", nativeName: "Nederlands", direction: "ltr", ogLocale: "nl_NL" },
  ja: { htmlLang: "ja", nativeName: "日本語", direction: "ltr", ogLocale: "ja_JP" },
  ko: { htmlLang: "ko", nativeName: "한국어", direction: "ltr", ogLocale: "ko_KR" },
  zh: { htmlLang: "zh-CN", nativeName: "中文", direction: "ltr", ogLocale: "zh_CN" },
  ar: { htmlLang: "ar", nativeName: "العربية", direction: "rtl", ogLocale: "ar_SA" },
};

const semanticPortuguese = {
  "language.label": "Idioma",
  "cart.add": "Adicionar ao carrinho",
  "cart.choose": "Escolha as opções",
  "cart.select": "Selecione as opções",
  "cart.unavailable": "Indisponível",
  "share.found": "Olha o que eu achei na DropBox! 👀⚽",
  "share.look": "Dá uma olhada:",
  "share.copySuccess": "Link copiado!",
  "share.copyError": "Não foi possível copiar o link.",
  "share.nativeError": "Não foi possível abrir o compartilhamento do dispositivo.",
  "whatsapp.product": "Olá! 👋 Tenho uma dúvida sobre este produto:",
  "whatsapp.home": "Olá! 👋 Preciso de ajuda com a minha compra na DropBox.",
  "whatsapp.talk": "Fale conosco",
  "seo.check": "Confira fotos, opções e entrega na DropBox.",
  "theme.toLight": "Mudar para modo claro",
  "theme.toDark": "Mudar para modo escuro",
} as const;

export type SemanticKey = keyof typeof semanticPortuguese;

const generatedModules = import.meta.glob("./generated/*.json", {
  import: "default",
}) as Record<string, () => Promise<Catalog>>;

const catalogCache = new Map<Locale, Catalog>([["pt", {}]]);

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isLocale(value: string | null): value is Locale {
  return Boolean(value && (SUPPORTED_LOCALES as readonly string[]).includes(value));
}

export function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "pt";
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : "pt";
  } catch {
    return "pt";
  }
}

async function loadCatalog(locale: Locale) {
  const cached = catalogCache.get(locale);
  if (cached) return cached;
  const loader = generatedModules[`./generated/${locale}.json`];
  if (!loader) return {};
  const catalog = await loader();
  catalogCache.set(locale, catalog);
  return catalog;
}

const conjunctions: Record<Locale, string> = {
  pt: "e",
  en: "and",
  es: "y",
  fr: "et",
  de: "und",
  it: "e",
  nl: "en",
  ja: "と",
  ko: "및",
  zh: "和",
  ar: "و",
};

function translateCommercialLabel(value: string, catalog: Catalog) {
  const phrases = [
    "Camisa de treino + calça",
    "Camisa + calção",
    "Regata + calção",
    "Casaco + calça",
    "Kit de treino",
    "Corta-vento",
    "Torcedor",
    "Jogador",
    "Feminina",
    "Retrô",
    "Infantil",
    "Modelo",
    "Calção",
    "Camisa",
    "Regata",
    "Calça",
    "Casaco",
    "Padrão",
  ];

  let output = value;
  for (const phrase of phrases) {
    const translated = catalog[normalize(phrase)];
    if (!translated || translated === phrase) continue;
    output = output.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), translated);
  }
  return output;
}

function translateVersionList(raw: string, locale: Locale, catalog: Catalog) {
  const items = raw
    .split(/\s+e\s+|,\s*/iu)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => translateCommercialLabel(item, catalog));

  if (items.length <= 1) return items[0] ?? raw;
  if (items.length === 2) return `${items[0]} ${conjunctions[locale]} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} ${conjunctions[locale]} ${items.at(-1)}`;
}

function translateDynamicText(source: string, locale: Locale, catalog: Catalog) {
  if (locale === "pt") return source;
  const compact = normalize(source);
  const exact = catalog[compact];
  if (exact) return exact;

  const lookup = (value: string) => catalog[normalize(value)] ?? value;
  let output = source;

  const genericDemand = "Produto sob demanda da DropBox, com as opções comerciais configuradas para esta linha.";
  const translatedDemand = lookup(genericDemand);
  if (translatedDemand !== genericDemand) output = output.replaceAll(genericDemand, translatedDemand);

  for (const label of ["Categoria", "Time", "Liga", "Campeonato", "Temporada", "Marca", "Detalhe"]) {
    const translated = lookup(label);
    if (translated === label) continue;
    output = output.replace(new RegExp(`\\b${label}:`, "giu"), `${translated}:`);
  }

  output = output.replace(/Versão:\s*([^.!?]+)\./giu, (_match, list: string) => {
    return `${lookup("Versão")}: ${translateVersionList(list, locale, catalog)}.`;
  });
  output = output.replace(/Versões disponíveis:\s*([^.!?]+)\./giu, (_match, list: string) => {
    return `${lookup("Versões disponíveis")}: ${translateVersionList(list, locale, catalog)}.`;
  });

  output = output.replace(/^Carrinho com\s+(\d+)\s+item\(ns\)$/iu, (_match, count: string) => {
    return `${lookup("Carrinho com")} ${count} ${lookup("itens")}`;
  });
  output = output.replace(/^Até\s+(\d+)\s+caracteres$/iu, (_match, count: string) => {
    return `${lookup("Até")} ${count} ${lookup("caracteres")}`;
  });
  output = output.replace(/^Adicionais desta peça:\s*(.+)$/iu, (_match, amount: string) => {
    return `${lookup("Adicionais desta peça")}: ${amount}`;
  });
  output = output.replace(/^Prazo total estimado:\s*(.+)$/iu, (_match, rest: string) => {
    return `${lookup("Prazo total estimado")}: ${rest}`;
  });

  if (/^Switch to (?:light|dark) mode$/i.test(output)) {
    return /light/i.test(output) ? lookup("Mudar para modo claro") : lookup("Mudar para modo escuro");
  }

  return output;
}

const I18N_ATTRIBUTE_NAMES = ["placeholder", "title", "aria-label", "aria-description"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT"]);

function shouldSkip(element: Element | null) {
  if (!element) return false;
  if (SKIP_TAGS.has(element.tagName)) return true;
  return Boolean(element.closest("[data-no-i18n]"));
}

type I18nContextValue = {
  locale: Locale;
  direction: TextDirection;
  setLocale: (locale: Locale) => void;
  t: (key: SemanticKey) => string;
  translateText: (value: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt");
  const [catalog, setCatalog] = useState<Catalog>({});
  const textOriginals = useRef(new WeakMap<Text, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const stored = getStoredLocale();
    if (stored !== "pt") setLocaleState(stored);
  }, []);

  useEffect(() => {
    let active = true;
    setCatalog(locale === "pt" ? {} : catalogCache.get(locale) ?? {});
    void loadCatalog(locale).then((next) => {
      if (active) setCatalog(next);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  const translateText = useCallback(
    (value: string) => translateDynamicText(value, locale, catalog),
    [catalog, locale],
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(nextLocale)) return;
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Storage can be blocked; the in-memory locale still works for this session.
    }
  }, []);

  useEffect(() => {
    const meta = LOCALE_META[locale];
    document.documentElement.lang = meta.htmlLang;
    document.documentElement.dir = meta.direction;
    document.documentElement.dataset.locale = locale;

    const textMap = textOriginals.current;
    const attrMap = attributeOriginals.current;

    const applyText = (node: Text, refreshOriginal = false) => {
      const parent = node.parentElement;
      if (!parent || shouldSkip(parent)) return;
      const current = node.data;
      const knownOriginal = textMap.get(node);
      if (!knownOriginal) textMap.set(node, current);
      else if (refreshOriginal) {
        const expected = translateDynamicText(knownOriginal, locale, catalog);
        if (current !== expected && current !== knownOriginal) textMap.set(node, current);
      }
      const original = textMap.get(node) ?? current;
      const next = locale === "pt" ? original : translateDynamicText(original, locale, catalog);
      if (node.data !== next) node.data = next;
    };

    const applyAttribute = (element: Element, name: string, refreshOriginal = false) => {
      if (shouldSkip(element)) return;
      const current = element.getAttribute(name);
      if (!current) return;
      let originals = attrMap.get(element);
      if (!originals) {
        originals = new Map();
        attrMap.set(element, originals);
      }
      const knownOriginal = originals.get(name);
      if (!knownOriginal) originals.set(name, current);
      else if (refreshOriginal) {
        const expected = translateDynamicText(knownOriginal, locale, catalog);
        if (current !== expected && current !== knownOriginal) originals.set(name, current);
      }
      const original = originals.get(name) ?? current;
      const next = locale === "pt" ? original : translateDynamicText(original, locale, catalog);
      if (current !== next) element.setAttribute(name, next);
    };

    const scanElement = (element: Element) => {
      if (shouldSkip(element)) return;
      for (const attribute of I18N_ATTRIBUTE_NAMES) applyAttribute(element, attribute);
      if (element instanceof HTMLMetaElement) {
        const key = element.getAttribute("name") ?? element.getAttribute("property") ?? "";
        if (/^(?:description|og:title|og:description|og:image:alt|twitter:title|twitter:description)$/i.test(key)) {
          applyAttribute(element, "content");
        }
      }
    };

    const scan = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        applyText(root as Text);
        return;
      }
      if (!(root instanceof Element) && !(root instanceof Document)) return;
      if (root instanceof Element) scanElement(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) applyText(current as Text);
        else if (current instanceof Element) scanElement(current);
        current = walker.nextNode();
      }
    };

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          applyText(mutation.target as Text, true);
        } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
          if (mutation.attributeName) applyAttribute(mutation.target, mutation.attributeName, true);
        } else {
          for (const node of mutation.addedNodes) scan(node);
        }
      }
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...I18N_ATTRIBUTE_NAMES, "content"],
      });
    });

    scan(document.documentElement);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...I18N_ATTRIBUTE_NAMES, "content"],
    });

    return () => observer.disconnect();
  }, [catalog, locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: LOCALE_META[locale].direction,
      setLocale,
      t: (key) => translateText(semanticPortuguese[key]),
      translateText,
    }),
    [locale, setLocale, translateText],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider");
  return context;
}
`;

const languageSwitcher = String.raw`import { Languages } from "lucide-react";

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
`;

const stage6Controls = String.raw`import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";

export function Stage6HeaderControls({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      data-stage6-header-controls
      className={
        mobile
          ? "flex w-full items-center justify-between gap-3"
          : "flex shrink-0 items-center gap-2"
      }
    >
      <CinematicThemeSwitcher />
      <LanguageSwitcher mobile={mobile} />
    </div>
  );
}
`;

const sourcePhrases = String.raw`export const STAGE6_TRANSLATION_SOURCE_PHRASES = [
  "Idioma",
  "Adicionar ao carrinho",
  "Escolha as opções",
  "Selecione as opções",
  "Indisponível",
  "Olha o que eu achei na DropBox! 👀⚽",
  "Dá uma olhada:",
  "Link copiado!",
  "Não foi possível copiar o link.",
  "Não foi possível abrir o compartilhamento do dispositivo.",
  "Olá! 👋 Tenho uma dúvida sobre este produto:",
  "Olá! 👋 Preciso de ajuda com a minha compra na DropBox.",
  "Fale conosco",
  "Confira fotos, opções e entrega na DropBox.",
  "Mudar para modo claro",
  "Mudar para modo escuro",
  "Produto sob demanda da DropBox, com as opções comerciais configuradas para esta linha.",
  "Versão",
  "Versões disponíveis",
  "Categoria",
  "Time",
  "Liga",
  "Campeonato",
  "Temporada",
  "Marca",
  "Detalhe",
  "Torcedor",
  "Jogador",
  "Feminina",
  "Retrô",
  "Infantil",
  "Corta-vento",
  "Kit de treino",
  "Modelo",
  "Calção",
  "Camisa",
  "Regata",
  "Calça",
  "Casaco",
  "Padrão",
  "Camisa de treino + calça",
  "Camisa + calção",
  "Regata + calção",
  "Casaco + calça",
  "Carrinho com",
  "itens",
  "Até",
  "caracteres",
  "Adicionais desta peça",
  "Prazo total estimado",
  "dias úteis",
] as const;
`;

const stage6ThemeCss = String.raw`/* Stage 6: complete dark-mode compatibility for legacy storefront/admin utility classes. */
.dark {
  color-scheme: dark;
}

.dark body {
  background-color: var(--background);
  background-image:
    radial-gradient(circle at 8% 2%, rgba(230, 0, 0, 0.13), transparent 23rem),
    radial-gradient(circle at 92% 14%, rgba(59, 130, 246, 0.08), transparent 29rem),
    linear-gradient(180deg, #090d16, #111827 62%, #0b1019);
}

.dark .glass-card,
.dark .glass-panel {
  border-color: rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.82) 48%, rgba(17, 24, 39, 0.92)),
    radial-gradient(circle at 12% -8%, rgba(148, 163, 184, 0.16), transparent 38%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(255, 255, 255, 0.03),
    var(--glass-shadow-soft);
}

.dark .glass-header {
  border-bottom-color: rgba(255, 255, 255, 0.09);
  background: rgba(10, 15, 25, 0.92);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.26);
}

.dark .glass-input,
.dark input,
.dark textarea,
.dark select {
  border-color: rgba(148, 163, 184, 0.24);
  background-color: rgba(15, 23, 42, 0.82);
  color: #f8fafc;
}

.dark input::placeholder,
.dark textarea::placeholder {
  color: #94a3b8;
}

.dark .brand-lockup,
.dark .header-action {
  border-color: rgba(255, 255, 255, 0.1);
  background: linear-gradient(145deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.86));
  color: #f8fafc;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 8px 22px rgba(0, 0, 0, 0.22);
}

.dark .display-title,
.dark .display-title-sm {
  color: #f8fafc;
}

.dark .section-copy {
  color: #cbd5e1;
}

.dark .ambient-band {
  border-color: rgba(255, 255, 255, 0.08);
  background:
    radial-gradient(circle at 18% 30%, rgba(230, 0, 0, 0.18), transparent 28%),
    radial-gradient(circle at 82% 46%, rgba(59, 130, 246, 0.11), transparent 30%),
    linear-gradient(120deg, rgba(15, 23, 42, 0.92), rgba(17, 24, 39, 0.96));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.dark .bg-white,
.dark .bg-white\/95,
.dark .bg-white\/90,
.dark .bg-white\/80,
.dark .bg-white\/70,
.dark .bg-white\/60,
.dark .bg-gray-50,
.dark .bg-gray-100 {
  background-color: #111827 !important;
}

.dark .bg-gray-200 {
  background-color: #1f2937 !important;
}

.dark .text-gray-950,
.dark .text-gray-900,
.dark .text-gray-800,
.dark .text-gray-700 {
  color: #f8fafc !important;
}

.dark .text-gray-600,
.dark .text-gray-500 {
  color: #cbd5e1 !important;
}

.dark .text-gray-400 {
  color: #94a3b8 !important;
}

.dark .border-white,
.dark .border-gray-100,
.dark .border-gray-200,
.dark .border-gray-300 {
  border-color: rgba(148, 163, 184, 0.22) !important;
}

.dark .hover\:bg-gray-50:hover,
.dark .hover\:bg-gray-100:hover {
  background-color: #1f2937 !important;
}

.dark [data-product-card],
.dark [role="dialog"],
.dark [data-radix-popper-content-wrapper] > * {
  color: var(--foreground);
}

.dark [data-motion-button] .icon svg,
.dark [data-motion-button]:hover .button-text {
  color: #fff !important;
}

html[dir="rtl"] body {
  direction: rtl;
}

html[dir="rtl"] input[type="email"],
html[dir="rtl"] input[type="tel"],
html[dir="rtl"] input[inputmode="numeric"],
html[dir="rtl"] input[inputmode="decimal"],
html[dir="rtl"] [data-ltr] {
  direction: ltr;
  text-align: left;
}

html[dir="rtl"] img,
html[dir="rtl"] svg[data-no-rtl-mirror] {
  transform: none;
}

@media (max-width: 767px) {
  .dark body {
    background-image:
      radial-gradient(circle at 12% 0%, rgba(230, 0, 0, 0.11), transparent 16rem),
      linear-gradient(180deg, #090d16, #111827);
  }

  .dark .glass-card,
  .dark .glass-panel,
  .dark .glass-header,
  .dark .glass-input {
    background-color: rgba(15, 23, 42, 0.97);
  }
}
`;

const productShare = String.raw`import { Copy, Link2, MessageCircle, Send, Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n";

interface ProductShareProps {
  productName: string;
  canonicalUrl: string;
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy_failed");
}

export function ProductShare({ productName, canonicalUrl }: ProductShareProps) {
  const { t, translateText } = useI18n();
  const [open, setOpen] = useState(false);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);
  const shareHeadline = t("share.found");
  const shareLook = t("share.look");
  const shareMessage = `${shareHeadline}\n${productName}\n${shareLook} ${canonicalUrl}`;
  const whatsAppUrl = "https://wa.me/?text=" + encodeURIComponent(shareMessage);
  const shareText = `${shareHeadline}\n${productName}\n${shareLook}`;
  const telegramUrl =
    "https://t.me/share/url?url=" +
    encodeURIComponent(canonicalUrl) +
    "&text=" +
    encodeURIComponent(shareText);

  useEffect(() => {
    setNativeShareAvailable(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  const handleCopy = async () => {
    try {
      await copyToClipboard(canonicalUrl);
      setOpen(false);
      toast.success(t("share.copySuccess"));
    } catch {
      toast.error(t("share.copyError"));
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: productName,
        text: shareText,
        url: canonicalUrl,
      });
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("share.nativeError"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-product-share-trigger
          type="button"
          variant="outline"
          className="h-10 gap-2 rounded-lg border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 shadow-none hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
          aria-label={translateText("Compartilhar") + " " + productName}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Compartilhar
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-product-share-menu
        align="start"
        sideOffset={8}
        className="w-72 rounded-xl border-gray-200 p-2 shadow-xl"
      >
        <p className="px-2 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
          Compartilhar produto
        </p>
        <div className="grid gap-1">
          <a
            data-share-whatsapp
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            WhatsApp
          </a>
          <button
            data-share-copy
            type="button"
            onClick={handleCopy}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Copy className="h-5 w-5 text-gray-500" aria-hidden="true" />
            Copiar link
          </button>
          {nativeShareAvailable ? (
            <button
              data-share-native
              type="button"
              onClick={handleNativeShare}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <Smartphone className="h-5 w-5 text-gray-500" aria-hidden="true" />
              Compartilhar pelo dispositivo
            </button>
          ) : null}
          <a
            data-share-telegram
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Send className="h-5 w-5 text-sky-600" aria-hidden="true" />
            Telegram
          </a>
        </div>
        <div className="mt-2 flex items-center gap-2 border-t border-gray-100 px-2 pt-2 text-[11px] text-gray-400">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          Link oficial da DropBox
        </div>
      </PopoverContent>
    </Popover>
  );
}
`;

const whatsappSupport = String.raw`import { MessageCircle, Phone } from "lucide-react";

import { BRAND } from "@/config/brand";
import { useI18n } from "@/i18n";

interface FloatingWhatsAppSupportProps {
  productName?: string;
  productUrl?: string;
  productPage?: boolean;
}

function appendMessage(baseUrl: string, message: string) {
  return baseUrl + (baseUrl.includes("?") ? "&" : "?") + "text=" + encodeURIComponent(message);
}

export function FloatingWhatsAppSupport({
  productName,
  productUrl,
  productPage = false,
}: FloatingWhatsAppSupportProps) {
  const { t, translateText } = useI18n();
  const message =
    productName && productUrl
      ? t("whatsapp.product") + " " + productName + " — " + productUrl
      : t("whatsapp.home");
  const href = appendMessage(BRAND.whatsappUrl, message);
  const bottomClass = productPage
    ? "bottom-[calc(env(safe-area-inset-bottom)+6.5rem)]"
    : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]";

  return (
    <a
      data-floating-whatsapp
      data-product-context={productName && productUrl ? "true" : "false"}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        productName
          ? translateText("Falar sobre") + " " + productName + " " + translateText("pelo WhatsApp")
          : translateText("Falar com a DropBox pelo WhatsApp")
      }
      className={
        "group fixed right-4 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-[#25D366] text-white shadow-[0_10px_28px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transform-none motion-reduce:transition-none md:bottom-6 md:right-6 " +
        bottomClass
      }
    >
      <span className="relative inline-flex h-8 w-8 items-center justify-center" aria-hidden="true">
        <MessageCircle className="absolute h-8 w-8" strokeWidth={2.25} />
        <Phone className="h-3.5 w-3.5 fill-current" strokeWidth={2.4} />
      </span>
      <span className="pointer-events-none absolute right-[calc(100%+0.75rem)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-950 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none md:block">
        {t("whatsapp.talk")}
      </span>
    </a>
  );
}
`;

const validator = String.raw`import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`STAGE6_I18N_ERROR ${message}`);
  process.exitCode = 1;
};

const locales = ["en", "es", "fr", "de", "it", "nl", "ja", "ko", "zh", "ar"];
const i18n = read("src/i18n/index.tsx");
const rootRoute = read("src/routes/__root.tsx");
const header = read("src/components/layout/Header.tsx");
const product = read("src/routes/product/$id.tsx");
const motion = read("src/components/ui/motion-button.tsx");
const theme = read("src/stage6-theme.css");
const share = read("src/components/product/ProductShare.tsx");
const whatsapp = read("src/components/support/FloatingWhatsAppSupport.tsx");
const validateMain = read(".github/workflows/validate-main.yml");
const pkg = JSON.parse(read("package.json"));

for (const dependency of ["next-themes", "framer-motion"]) {
  if (!pkg.dependencies?.[dependency]) fail(`missing dependency ${dependency}`);
}

for (const locale of locales) {
  const file = path.join(root, "src/i18n/generated", `${locale}.json`);
  if (!fs.existsSync(file)) {
    fail(`missing generated catalog ${locale}`);
    continue;
  }
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  if (Object.keys(json).length < 120) fail(`catalog ${locale} is unexpectedly small`);
}

for (const token of ["dropbox-locale", 'dir = meta.direction', 'import.meta.glob("./generated/*.json"', "MutationObserver"]) {
  if (!i18n.includes(token)) fail(`i18n architecture missing ${token}`);
}

for (const token of ["ThemeProvider", 'storageKey="dropbox-theme"', "I18nProvider", "stage6ThemeCss"]) {
  if (!rootRoute.includes(token)) fail(`root integration missing ${token}`);
}

if (!header.includes("Stage6HeaderControls")) fail("header controls are not integrated");
if (!product.includes("<MotionButton")) fail("product CTA is not using MotionButton");
if (!product.includes("handleAddToCart")) fail("existing add-to-cart handler was lost");
if (!motion.includes("var(--brand-accent)")) fail("MotionButton does not use DropBox red");
if (!theme.includes('html[dir="rtl"]')) fail("RTL theme support is missing");
if (!share.includes("useI18n")) fail("share messages are not localized");
if (!whatsapp.includes("useI18n")) fail("WhatsApp messages are not localized");
if (!validateMain.includes("validate-stage6-i18n.mjs")) fail("main CI does not enforce Stage 6 gate");

if (!process.exitCode) {
  console.log("STAGE6_I18N_OK locales=11 runtime_translation_api=none rtl=enabled theme=persistent motion_button=enabled");
}
`;

await write("src/i18n/index.tsx", i18nIndex);
await write("src/components/layout/LanguageSwitcher.tsx", languageSwitcher);
await write("src/components/layout/Stage6HeaderControls.tsx", stage6Controls);
await write("src/stage6-i18n-source.ts", sourcePhrases);
await write("src/stage6-theme.css", stage6ThemeCss);
await write("src/components/product/ProductShare.tsx", productShare);
await write("src/components/support/FloatingWhatsAppSupport.tsx", whatsappSupport);
await write("scripts/validate-stage6-i18n.mjs", validator);

let generator = await read("scripts/stage6-generate-translations.mjs");
generator = generator.replace(
  "perguntas|frequentes)\\b)",
  "perguntas|frequentes|idioma|tema|claro|escuro|compartilhar|link|fale|ajuda|dúvida|duvida|este|encontrei|olha|dispositivo|torcedor|jogador|feminina|retro|retrô|infantil|corta|vento|calção|calcao|short|modelo|versão|versao|versões|versoes|disponíveis|disponiveis|camisa|regata|calça|calca|casaco|itens|caracteres)\\b)",
);
if (!generator.includes("ts.isTemplateExpression")) {
  generator = generator.replace(
    "if (ts.isJsxText(node)) add(node.getText(sf));",
    `if (ts.isJsxText(node)) add(node.getText(sf));\n    if (ts.isTemplateExpression(node)) {\n      add(node.head.text);\n      for (const span of node.templateSpans) add(span.literal.text);\n    }`,
  );
}
await write("scripts/stage6-generate-translations.mjs", generator);

let rootRoute = await read("src/routes/__root.tsx");
rootRoute = replaceRequired(
  rootRoute,
  'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";',
  'import { QueryClient, QueryClientProvider } from "@tanstack/react-query";\nimport { ThemeProvider } from "next-themes";',
  "root ThemeProvider import",
);
rootRoute = replaceRequired(
  rootRoute,
  'import sportThemeCss from "../sport-theme.css?url";',
  'import sportThemeCss from "../sport-theme.css?url";\nimport stage6ThemeCss from "../stage6-theme.css?url";',
  "root theme css import",
);
rootRoute = replaceRequired(
  rootRoute,
  'import { getR2PublicBaseUrl } from "@/lib/product-images";',
  'import { getR2PublicBaseUrl } from "@/lib/product-images";\nimport { I18nProvider } from "@/i18n";',
  "root i18n import",
);
rootRoute = replaceRequired(
  rootRoute,
  '      { rel: "stylesheet", href: sportThemeCss },',
  '      { rel: "stylesheet", href: sportThemeCss },\n      { rel: "stylesheet", href: stage6ThemeCss },',
  "root theme stylesheet",
);
rootRoute = replaceRequired(
  rootRoute,
  `function RootShell({ children }: { children: ReactNode }) {\n  return (\n    <html lang="pt-BR">\n      <head>\n        <HeadContent />\n      </head>\n      <body style={{ background: "#ffffff" }}>\n        {children}\n        <Scripts />\n      </body>\n    </html>\n  );\n}`,
  `function RootShell({ children }: { children: ReactNode }) {\n  const bootPreferences = \\`\n    try {\n      var theme = localStorage.getItem("dropbox-theme") || "light";\n      document.documentElement.classList.toggle("dark", theme === "dark");\n      document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";\n      var locale = localStorage.getItem("dropbox-locale") || "pt";\n      var rtl = locale === "ar";\n      document.documentElement.lang = locale === "pt" ? "pt-BR" : locale === "zh" ? "zh-CN" : locale;\n      document.documentElement.dir = rtl ? "rtl" : "ltr";\n    } catch {}\n  \\`;\n\n  return (\n    <html lang="pt-BR" suppressHydrationWarning>\n      <head>\n        <script dangerouslySetInnerHTML={{ __html: bootPreferences }} />\n        <HeadContent />\n      </head>\n      <body>\n        {children}\n        <Scripts />\n      </body>\n    </html>\n  );\n}`,
  "root shell",
);
rootRoute = rootRoute.replace('background: "#ffffff",', 'background: "var(--background)",');
rootRoute = replaceRequired(
  rootRoute,
  `    <QueryClientProvider client={queryClient}>\n      <AuthProvider>`,
  `    <QueryClientProvider client={queryClient}>\n      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="dropbox-theme">\n        <I18nProvider>\n          <AuthProvider>`,
  "provider opening",
);
rootRoute = replaceRequired(
  rootRoute,
  `      </AuthProvider>\n    </QueryClientProvider>`,
  `          </AuthProvider>\n        </I18nProvider>\n      </ThemeProvider>\n    </QueryClientProvider>`,
  "provider closing",
);
await write("src/routes/__root.tsx", rootRoute);

let header = await read("src/components/layout/Header.tsx");
header = replaceRequired(
  header,
  'import { BrandWordmark } from "@/components/brand/BrandWordmark";',
  'import { BrandWordmark } from "@/components/brand/BrandWordmark";\nimport { Stage6HeaderControls } from "@/components/layout/Stage6HeaderControls";',
  "header controls import",
);
header = header.replace('className="hidden md:block"', 'className="hidden lg:block"');
header = header.replace('className="md:hidden"', 'className="lg:hidden"');
header = replaceRequired(
  header,
  '            <div className="flex items-center gap-3">\n              <Link',
  '            <div className="flex items-center gap-3">\n              <Stage6HeaderControls />\n              <Link',
  "desktop header controls",
);
header = replaceRequired(
  header,
  '        <MobileLiquidMorphMenu\n          open={mobilePanel === "categories"}',
  '        <div className="border-t border-gray-100 px-4 py-3 dark:border-white/10">\n          <Stage6HeaderControls mobile />\n        </div>\n\n        <MobileLiquidMorphMenu\n          open={mobilePanel === "categories"}',
  "mobile header controls",
);
await write("src/components/layout/Header.tsx", header);

let motionButton = await read("src/components/ui/motion-button.tsx");
motionButton = motionButton.replace("      {...buttonProps}\n      disabled=", "      {...buttonProps}\n      data-motion-button\n      disabled=");
motionButton = motionButton.replace("circle bg-primary ", "circle bg-[var(--brand-accent)] ");
await write("src/components/ui/motion-button.tsx", motionButton);

let productRoute = await read("src/routes/product/$id.tsx");
productRoute = productRoute.replace("  ShoppingCart,\n", "");
productRoute = replaceRequired(
  productRoute,
  'import { Button } from "@/components/ui/button";',
  'import { Button } from "@/components/ui/button";\nimport MotionButton from "@/components/ui/motion-button";',
  "product MotionButton import",
);
productRoute = replaceRequired(
  productRoute,
  "  const [quantity, setQuantity] = useState(1);",
  "  const [quantity, setQuantity] = useState(1);\n  const [addingToCart, setAddingToCart] = useState(false);",
  "product add state",
);
productRoute = replaceRequired(
  productRoute,
  "  const handleAddToCart = () => {\n    if (!selectedVariant || !selectionComplete) {",
  "  const handleAddToCart = () => {\n    if (addingToCart) return;\n    if (!selectedVariant || !selectionComplete) {",
  "product duplicate click guard",
);
productRoute = replaceRequired(
  productRoute,
  "    addToCart(\n      {",
  "    setAddingToCart(true);\n    addToCart(\n      {",
  "product adding state start",
);
productRoute = replaceRequired(
  productRoute,
  "      quantity,\n    );\n  };",
  "      quantity,\n    );\n    window.setTimeout(() => setAddingToCart(false), 450);\n  };",
  "product adding state end",
);
const desktopButton = `              <Button\n                onClick={handleAddToCart}\n                disabled={!selectedVariant || !selectionComplete}\n                className={\ `flex h-14 w-full items-center justify-center gap-3 rounded-sm text-lg font-black uppercase tracking-tight transition-all duration-300 sm:h-16 ${\n                  selectedVariant && selectionComplete\n                    ? "bg-red-600 text-white shadow-lg shadow-red-600/20 hover:bg-black hover:shadow-black/20"\n                    : "cursor-not-allowed bg-gray-200 text-gray-400"\n                }\ `}\n              >\n                <ShoppingCart className="h-6 w-6" />\n                {!selectionComplete\n                  ? "Selecione as opções"\n                  : availableToOrder\n                    ? "Adicionar ao Carrinho"\n                    : "Indisponível"}\n              </Button>`;
const desktopNeedle = desktopButton.replaceAll("\u0000", "`");
const desktopReplacement = `              <MotionButton\n                type="button"\n                onClick={handleAddToCart}\n                disabled={!selectedVariant || !selectionComplete || !purchaseConfig}\n                loading={addingToCart}\n                label={\n                  !selectionComplete\n                    ? "Selecione as opções"\n                    : availableToOrder\n                      ? "Adicionar ao carrinho"\n                      : "Indisponível"\n                }\n                classes="w-full"\n              />`;
productRoute = replaceRequired(productRoute, desktopNeedle, desktopReplacement, "desktop motion button");
const mobileNeedle = `          <Button\n            onClick={handleAddToCart}\n            disabled={!selectedVariant || !selectionComplete || !purchaseConfig}\n            className="h-12 flex-[1.35] rounded-xl bg-red-600 px-4 text-sm font-black text-white hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"\n          >\n            <ShoppingCart className="mr-2 h-4 w-4" />\n            {!selectionComplete ? "Escolha as opções" : "Adicionar"}\n          </Button>`;
const mobileReplacement = `          <MotionButton\n            type="button"\n            onClick={handleAddToCart}\n            disabled={!selectedVariant || !selectionComplete || !purchaseConfig}\n            loading={addingToCart}\n            label={\n              !selectionComplete\n                ? "Escolha as opções"\n                : availableToOrder\n                  ? "Adicionar ao carrinho"\n                  : "Indisponível"\n            }\n            classes="w-full flex-[1.35]"\n          />`;
productRoute = replaceRequired(productRoute, mobileNeedle, mobileReplacement, "mobile motion button");
await write("src/routes/product/$id.tsx", productRoute);

let productSeo = await read("src/components/product/ProductSeo.tsx");
productSeo = replaceRequired(
  productSeo,
  'import { BRAND } from "@/config/brand";',
  'import { BRAND } from "@/config/brand";\nimport { LOCALE_META, useI18n } from "@/i18n";',
  "seo i18n import",
);
productSeo = replaceRequired(
  productSeo,
  `}: ProductSeoProps) {\n  useEffect(() => {`,
  `}: ProductSeoProps) {\n  const { locale, translateText } = useI18n();\n\n  useEffect(() => {`,
  "seo hook",
);
productSeo = replaceRequired(
  productSeo,
  `    const description =\n      product.description?.trim().slice(0, 160) ||\n      \ ${product.name}${context ? \  — ${context}\  : ""}. Confira fotos, opções e entrega na ${BRAND.officialName}.\ .slice(\n        0,\n        160,\n      );`.replaceAll("\u0000", "`"),
  `    const storedDescription = product.description?.trim() ? translateText(product.description.trim()) : "";\n    const description =\n      storedDescription.slice(0, 160) ||\n      (product.name +\n        (context ? " — " + context : "") +\n        ". " +\n        translateText("Confira fotos, opções e entrega na DropBox.")).slice(0, 160);`,
  "seo description",
);
productSeo = replaceRequired(
  productSeo,
  `    setManagedMeta(\n      'meta[property="og:type"]',`,
  `    setManagedMeta(\n      'meta[property="og:locale"]',\n      { property: "og:locale", content: LOCALE_META[locale].ogLocale },\n      cleanups,\n    );\n    setManagedMeta(\n      'meta[property="og:type"]',`,
  "seo og locale",
);
productSeo = productSeo.replace(
  "  }, [images, inStock, price, product]);",
  "  }, [images, inStock, locale, price, product, translateText]);",
);
await write("src/components/product/ProductSeo.tsx", productSeo);

let validateMain = await read(".github/workflows/validate-main.yml");
validateMain = replaceRequired(
  validateMain,
  "      - name: Validate affiliate referral backend",
  "      - name: Validate Stage 6 dark mode and i18n\n        run: node scripts/validate-stage6-i18n.mjs\n\n      - name: Validate affiliate referral backend",
  "main Stage 6 gate",
);
await write(".github/workflows/validate-main.yml", validateMain);

let packageJson = JSON.parse(await read("package.json"));
packageJson.scripts = {
  ...packageJson.scripts,
  "validate:stage6-i18n": "node scripts/validate-stage6-i18n.mjs",
};
await write("package.json", JSON.stringify(packageJson, null, 2) + "\n");

console.log("STAGE6_APPLY_OK");
