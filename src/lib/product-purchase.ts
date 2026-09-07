import { supabase } from "@/integrations/supabase/client";

export type ProductCommercialType =
  "torcedor" | "feminino" | "jogador" | "retro" | "infantil" | "calcao" | "basquete" | "other";

export type PurchaseCustomization = {
  size: string | null;
  personalization: { name: string; number: string } | null;
  phrase: string | null;
  patchCode: string | null;
};

export type PurchasePatch = {
  code: string;
  label: string;
  price: number;
};

export type ProductPurchaseConfig = {
  sizes: string[];
  personalizationPrice: number;
  personalizationNameMax: number;
  phrasePrice: number;
  phraseMax: number;
  patchDefaultPrice: number;
  productionBusinessDays: number;
  deliveryMinBusinessDays: number;
  deliveryMaxBusinessDays: number;
  commercialType: ProductCommercialType;
  sizeEnabled: boolean;
  personalizationEnabled: boolean;
  phraseEnabled: boolean;
  patches: PurchasePatch[];
};

export const EMPTY_PURCHASE_CUSTOMIZATION: PurchaseCustomization = {
  size: null,
  personalization: null,
  phrase: null,
  patchCode: null,
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizePurchaseCustomization(value: unknown): PurchaseCustomization {
  const row = record(value);
  const personalizationRow = record(row.personalization);
  const name = typeof personalizationRow.name === "string" ? personalizationRow.name.trim() : "";
  const number =
    typeof personalizationRow.number === "string" ? personalizationRow.number.trim() : "";
  return {
    size: typeof row.size === "string" && row.size.trim() ? row.size.trim().toUpperCase() : null,
    personalization: name || number ? { name, number } : null,
    phrase: typeof row.phrase === "string" && row.phrase.trim() ? row.phrase.trim() : null,
    patchCode:
      typeof row.patchCode === "string" && row.patchCode.trim() ? row.patchCode.trim() : null,
  };
}

function normalizeConfig(value: unknown): ProductPurchaseConfig {
  const row = record(value);
  const allowedTypes: ProductCommercialType[] = [
    "torcedor",
    "feminino",
    "jogador",
    "retro",
    "infantil",
    "calcao",
    "basquete",
    "other",
  ];
  const commercialType = allowedTypes.includes(row.commercialType as ProductCommercialType)
    ? (row.commercialType as ProductCommercialType)
    : "other";
  return {
    sizes: Array.isArray(row.sizes)
      ? row.sizes.filter((item): item is string => typeof item === "string")
      : ["P", "M", "G", "GG", "2GG", "3GG", "4XL"],
    personalizationPrice: numberValue(row.personalizationPrice, 25),
    personalizationNameMax: numberValue(row.personalizationNameMax, 12),
    phrasePrice: numberValue(row.phrasePrice, 45),
    phraseMax: numberValue(row.phraseMax, 50),
    patchDefaultPrice: numberValue(row.patchDefaultPrice, 15),
    productionBusinessDays: numberValue(row.productionBusinessDays, 5),
    deliveryMinBusinessDays: numberValue(row.deliveryMinBusinessDays, 15),
    deliveryMaxBusinessDays: numberValue(row.deliveryMaxBusinessDays, 25),
    commercialType,
    sizeEnabled: row.sizeEnabled !== false,
    personalizationEnabled: row.personalizationEnabled !== false,
    phraseEnabled: row.phraseEnabled !== false,
    patches: Array.isArray(row.patches)
      ? row.patches.flatMap((item) => {
          const patch = record(item);
          return typeof patch.code === "string" && typeof patch.label === "string"
            ? [{ code: patch.code, label: patch.label, price: numberValue(patch.price, 15) }]
            : [];
        })
      : [],
  };
}

export async function fetchProductPurchaseConfig(productId: string) {
  const { data, error } = await supabase.rpc("get_product_purchase_config", {
    p_product_id: productId,
  });
  if (error) throw error;
  return normalizeConfig(data);
}

export function calculatePurchaseSurcharge(
  config: ProductPurchaseConfig,
  customization: PurchaseCustomization,
) {
  let total = 0;
  if (customization.personalization) total += config.personalizationPrice;
  if (customization.phrase) total += config.phrasePrice;
  if (customization.patchCode) {
    total += config.patches.find((patch) => patch.code === customization.patchCode)?.price ?? 0;
  }
  return total;
}

export function validatePurchaseCustomization(
  config: ProductPurchaseConfig,
  customization: PurchaseCustomization,
) {
  if (config.sizeEnabled && (!customization.size || !config.sizes.includes(customization.size))) {
    return "Escolha o tamanho da peça.";
  }
  if (customization.personalization && customization.phrase) {
    return "Escolha personalização comum ou frase personalizada.";
  }
  if (customization.personalization) {
    if (!customization.personalization.name.trim()) return "Informe o nome da personalização.";
    if (customization.personalization.name.trim().length > config.personalizationNameMax) {
      return `O nome pode ter no máximo ${config.personalizationNameMax} caracteres.`;
    }
    if (!/^\d{1,3}$/.test(customization.personalization.number)) {
      return "Informe um número válido para a personalização.";
    }
  }
  if (customization.phrase && customization.phrase.length > config.phraseMax) {
    return `A frase pode ter no máximo ${config.phraseMax} caracteres.`;
  }
  if (
    customization.patchCode &&
    !config.patches.some((patch) => patch.code === customization.patchCode)
  ) {
    return "Escolha um patch disponível para este produto.";
  }
  return null;
}

export function customizationToCartOptions(
  config: ProductPurchaseConfig,
  customization: PurchaseCustomization,
) {
  const options: Array<{
    optionId: string;
    optionName: string;
    optionKind: "size" | "style" | "color" | "other";
    valueId: string;
    valueLabel: string;
  }> = [];
  if (customization.size) {
    options.push({
      optionId: "purchase-size",
      optionName: "Tamanho",
      optionKind: "size",
      valueId: customization.size.toLowerCase(),
      valueLabel: customization.size,
    });
  }
  if (customization.personalization) {
    options.push({
      optionId: "purchase-name",
      optionName: "Nome personalizado",
      optionKind: "other",
      valueId: "custom-name",
      valueLabel: customization.personalization.name,
    });
    options.push({
      optionId: "purchase-number",
      optionName: "Número",
      optionKind: "other",
      valueId: "custom-number",
      valueLabel: customization.personalization.number,
    });
  }
  if (customization.phrase) {
    options.push({
      optionId: "purchase-phrase",
      optionName: "Frase personalizada",
      optionKind: "other",
      valueId: "custom-phrase",
      valueLabel: customization.phrase,
    });
  }
  if (customization.patchCode) {
    const patch = config.patches.find((item) => item.code === customization.patchCode);
    if (patch)
      options.push({
        optionId: "purchase-patch",
        optionName: "Patch",
        optionKind: "other",
        valueId: patch.code,
        valueLabel: patch.label,
      });
  }
  return options;
}
