import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { formatBusinessDays, siteCopy } from "@/i18n/site-copy";
import { uiCopy } from "@/i18n/ui-copy";

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
const fragmentCache = new WeakMap<Catalog, ReadonlyArray<readonly [string, string]>>();

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

/**
 * Some of the legacy generated dictionaries contain empty values or two translations accidentally
 * joined by a newline. Never let those malformed entries reach the customer-facing UI. The curated
 * storefront dictionaries are checked before this legacy catalog.
 */
function sanitizeCatalogTranslation(source: string, target: string | undefined) {
  if (!target?.trim()) return null;
  const trimmed = target.trim();
  if (!source.includes("\n") && /\r?\n/u.test(trimmed)) {
    const firstNonEmptyLine = trimmed
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean);
    return firstNonEmptyLine ?? null;
  }
  return trimmed;
}

function deterministicCopy(locale: Locale, value: string) {
  if (locale === "pt") return value;
  const curated = siteCopy(locale, value);
  if (curated !== value) return curated;
  const legacyCurated = uiCopy(locale, value);
  return legacyCurated !== value ? legacyCurated : value;
}

function exactFromCatalog(catalog: Catalog, value: string, locale: Locale) {
  const compact = normalize(value);
  const deterministic = deterministicCopy(locale, compact);
  if (deterministic !== compact) return deterministic;
  return sanitizeCatalogTranslation(compact, catalog[compact]) ?? value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSafeCatalogFragment(source: string, target: string) {
  const compact = source.trim();
  if (compact.length < 12 || !compact.includes(" ")) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(compact)) return false;
  if (/[<>{}[\]]|=>|className|data-|aria-|https?:\/\//u.test(compact)) return false;
  if (/^(?:rgb|rgba|hsl|hsla|var|calc)\(/iu.test(compact)) return false;
  return Boolean(sanitizeCatalogTranslation(source, target));
}

function catalogFragments(catalog: Catalog) {
  const cached = fragmentCache.get(catalog);
  if (cached) return cached;

  const fragments = Object.entries(catalog)
    .filter(([source, target]) => isSafeCatalogFragment(source, target))
    .sort(([left], [right]) => right.length - left.length) as Array<readonly [string, string]>;
  fragmentCache.set(catalog, fragments);
  return fragments;
}

/**
 * Source extraction around template expressions can leave catalog keys such as
 * "Quando ... A" + {DropBox} + " entrará em contato". React renders that as one final text node,
 * so exact lookup alone cannot translate it. This conservative longest-fragment pass translates
 * only natural-language catalog fragments and leaves interpolated proper names, prices, IDs and
 * URLs untouched.
 */
function translateCatalogFragments(source: string, locale: Locale, catalog: Catalog) {
  if (source.trim().length < 12 || Object.keys(catalog).length === 0) return source;

  let output = source;
  for (const [fragment, rawTarget] of catalogFragments(catalog)) {
    if (!output.includes(fragment)) continue;
    const compact = normalize(fragment);
    const deterministic = deterministicCopy(locale, compact);
    const translated =
      deterministic !== compact
        ? deterministic
        : sanitizeCatalogTranslation(fragment, rawTarget);
    if (!translated || translated === fragment) continue;
    output = output.replaceAll(fragment, translated);
  }
  return output;
}

function translateCommercialLabel(value: string, locale: Locale, catalog: Catalog) {
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
    const translated = exactFromCatalog(catalog, phrase, locale);
    if (translated === phrase) continue;
    output = output.replace(new RegExp(escapeRegExp(phrase), "giu"), translated);
  }
  return output;
}

function translateVersionList(raw: string, locale: Locale, catalog: Catalog) {
  const items = raw
    .split(/\s+e\s+|,\s*/iu)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => translateCommercialLabel(item, locale, catalog));

  if (items.length <= 1) return items[0] ?? raw;
  if (items.length === 2) return `${items[0]} ${conjunctions[locale]} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} ${conjunctions[locale]} ${items.at(-1)}`;
}

function translateDynamicText(source: string, locale: Locale, catalog: Catalog) {
  if (locale === "pt") return source;

  const compact = normalize(source);
  if (!compact) return source;

  // Customer-visible critical copy always wins over legacy generated dictionaries. This also fixes
  // known wrong-language and empty entries without forcing a rewrite of historical generated JSON.
  const deterministic = deterministicCopy(locale, compact);
  if (deterministic !== compact) return deterministic;

  const exact = sanitizeCatalogTranslation(compact, catalog[compact]);
  if (exact) return exact;

  const lookup = (value: string) => exactFromCatalog(catalog, value, locale);
  let output = source;

  const genericDemand =
    "Produto sob demanda da DropBox, com as opções comerciais configuradas para esta linha.";
  const translatedDemand = lookup(genericDemand);
  if (translatedDemand !== genericDemand)
    output = output.replaceAll(genericDemand, translatedDemand);

  for (const label of [
    "Categoria",
    "Time",
    "Liga",
    "Campeonato",
    "Temporada",
    "Marca",
    "Detalhe",
  ]) {
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
    if (locale === "ja") return `${count}${lookup("caracteres")}まで`;
    if (locale === "ko") return `최대 ${count}${lookup("caracteres")}`;
    if (locale === "zh") return `最多 ${count}${lookup("caracteres")}`;
    return `${lookup("Até")} ${count} ${lookup("caracteres")}`;
  });
  output = output.replace(/^Até\s+(\d+)\s+caracteres,\s*sem números$/iu, (_match, count: string) => {
    if (locale === "ja") return `${count}${lookup("caracteres")}まで、${lookup("sem números")}`;
    if (locale === "ko") return `최대 ${count}${lookup("caracteres")}, ${lookup("sem números")}`;
    if (locale === "zh") return `最多 ${count}${lookup("caracteres")}，${lookup("sem números")}`;
    return `${lookup("Até")} ${count} ${lookup("caracteres")}, ${lookup("sem números")}`;
  });
  output = output.replace(/^Adicionais desta peça:\s*(.+)$/iu, (_match, amount: string) => {
    return `${lookup("Adicionais desta peça")}: ${amount}`;
  });
  output = output.replace(/^Prazo total estimado:\s*(.+)$/iu, (_match, rest: string) => {
    return `${lookup("Prazo total estimado")}: ${rest}`;
  });
  output = output.replace(/^(\d+)\s+a\s+(\d+)\s+dias úteis$/iu, (_match, min: string, max: string) => {
    return formatBusinessDays(locale, Number(min), Number(max));
  });
  output = output.replace(/^(\d+)\s+dias úteis$/iu, (_match, days: string) => {
    return formatBusinessDays(locale, Number(days));
  });

  if (/^Switch to (?:light|dark) mode$/i.test(output)) {
    return /light/i.test(output)
      ? lookup("Mudar para modo claro")
      : lookup("Mudar para modo escuro");
  }

  return translateCatalogFragments(output, locale, catalog);
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
    setCatalog(locale === "pt" ? {} : (catalogCache.get(locale) ?? {}));
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
        if (
          /^(?:description|og:title|og:description|og:image:alt|twitter:title|twitter:description)$/i.test(
            key,
          )
        ) {
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
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      );
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
