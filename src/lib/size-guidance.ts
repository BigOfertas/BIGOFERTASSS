import type { ProductCommercialType } from "@/lib/product-purchase";

export type SizeGuidanceKind =
  | "shirt"
  | "basketball"
  | "shorts"
  | "pants"
  | "outerwear"
  | "kids"
  | "shirt-shorts"
  | "tank-shorts"
  | "training-pants"
  | "jacket-pants"
  | "fallback";

export interface SizeGuidanceContext {
  commercialType?: ProductCommercialType | string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
}

export interface SizeGuidance {
  kind: SizeGuidanceKind;
  instruction: string;
}

export const SIZE_GUIDANCE_NOTE =
  "As medidas podem variar levemente entre modelos. O tamanho não altera o preço do produto.";

const GUIDANCE_BY_KIND: Record<SizeGuidanceKind, string> = {
  shirt: "Meça de uma axila à outra em uma camisa que já veste bem e compare com o guia de tamanhos.",
  basketball:
    "Meça de uma axila à outra em uma regata ou camiseta que já veste bem e compare com o guia.",
  shorts:
    "Meça a cintura de um short que já veste bem, com a peça estendida e sem esticar o elástico.",
  pants:
    "Meça a cintura de uma calça que já veste bem e compare também o comprimento da perna, se necessário.",
  outerwear:
    "Meça de uma axila à outra em um casaco que já veste bem e considere uma pequena folga para usar sobre outra peça.",
  kids: "Use a altura da criança como principal referência e compare com o guia de tamanhos antes de escolher.",
  "shirt-shorts":
    "Compare a largura de uma camisa que já veste bem e a cintura de um calção confortável.",
  "tank-shorts":
    "Compare a largura de uma regata que veste bem e a cintura de um calção confortável.",
  "training-pants":
    "Compare a largura da parte de cima na região do peito e a cintura de uma calça que já veste bem.",
  "jacket-pants": "Compare a largura de um casaco que veste bem e a cintura de uma calça confortável.",
  fallback:
    "Consulte o guia de tamanhos e compare as medidas com uma peça semelhante que já veste bem.",
};

function normalizeStructuredValue(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasWord(value: string, word: string) {
  return (` ${value} `).includes(` ${word} `);
}

function kindFromCommercialType(commercialType: string | null | undefined): SizeGuidanceKind | null {
  switch (normalizeStructuredValue(commercialType).replace(/ /g, "_")) {
    case "torcedor":
    case "jogador":
    case "feminino":
    case "retro":
      return "shirt";
    case "basquete":
    case "nba":
    case "regata":
      return "basketball";
    case "calcao":
    case "short":
    case "shorts":
      return "shorts";
    case "calca":
      return "pants";
    case "corta_vento":
    case "casaco":
      return "outerwear";
    case "infantil":
    case "kids":
      return "kids";
    case "camisa_calcao":
      return "shirt-shorts";
    case "regata_calcao":
      return "tank-shorts";
    case "treino_calca":
      return "training-pants";
    case "casaco_calca":
      return "jacket-pants";
    default:
      return null;
  }
}

function kindFromCategory(categoryName: string | null | undefined, categorySlug: string | null | undefined) {
  const category = normalizeStructuredValue([categorySlug, categoryName].filter(Boolean).join(" "));
  if (!category) return null;

  const hasCalcao = hasWord(category, "calcao") || hasWord(category, "calcoes") || hasWord(category, "short") || hasWord(category, "shorts");
  const hasCalca = hasWord(category, "calca") || hasWord(category, "calcas");
  const hasCamisa = hasWord(category, "camisa") || hasWord(category, "camisas") || hasWord(category, "camiseta") || hasWord(category, "camisetas");
  const hasRegata = hasWord(category, "regata") || hasWord(category, "regatas");
  const hasCasaco = hasWord(category, "casaco") || hasWord(category, "casacos") || (hasWord(category, "corta") && hasWord(category, "vento"));

  if (hasRegata && hasCalcao) return "tank-shorts" as const;
  if (hasCamisa && hasCalcao) return "shirt-shorts" as const;
  if (hasCasaco && hasCalca) return "jacket-pants" as const;
  if ((hasWord(category, "treino") || hasWord(category, "top") || hasCamisa) && hasCalca) {
    return "training-pants" as const;
  }
  if (hasWord(category, "infantil") || hasWord(category, "kids") || hasWord(category, "kid")) {
    return "kids" as const;
  }
  if (hasCalcao) return "shorts" as const;
  if (hasCalca) return "pants" as const;
  if (hasCasaco) return "outerwear" as const;
  if (hasRegata || hasWord(category, "basquete") || hasWord(category, "nba")) {
    return "basketball" as const;
  }
  if (hasCamisa) return "shirt" as const;

  return null;
}

export function getSizeGuidance(context: SizeGuidanceContext): SizeGuidance {
  const kind =
    kindFromCommercialType(context.commercialType) ??
    kindFromCategory(context.categoryName, context.categorySlug) ??
    "fallback";

  return {
    kind,
    instruction: GUIDANCE_BY_KIND[kind],
  };
}
