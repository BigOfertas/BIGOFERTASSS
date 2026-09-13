import { callSupabaseRpc } from "@/lib/supabase-rpc";

export const FINANCE_COMMERCIAL_TYPES = [
  "torcedor",
  "feminino",
  "jogador",
  "retro",
  "infantil",
  "calcao",
  "basquete",
  "camisa_calcao",
  "regata_calcao",
  "treino_calca",
  "casaco_calca",
  "corta_vento",
] as const;

export type FinanceCommercialType = (typeof FINANCE_COMMERCIAL_TYPES)[number];

export const FINANCE_COMMERCIAL_LABELS: Record<FinanceCommercialType, string> = {
  torcedor: "Torcedor",
  feminino: "Feminina",
  jogador: "Jogador",
  retro: "Retrô",
  infantil: "Kit Infantil",
  calcao: "Short / Calção",
  basquete: "Basquete / NBA",
  camisa_calcao: "Camisa + Calção",
  regata_calcao: "Regata + Calção",
  treino_calca: "Camisa/Top de Treino + Calça",
  casaco_calca: "Casaco + Calça",
  corta_vento: "Corta-vento",
};

export type FinanceCategoryRow = {
  commercialType: FinanceCommercialType;
  label: string;
  salePrice: number | null;
  unitCost: number | null;
  targetCount: number;
  productCount: number;
  individualCostOverrides: number;
};

export type FinanceCategorySettings = {
  categories: FinanceCategoryRow[];
};

export type FinanceCategoryApplyResult = {
  commercialType: FinanceCommercialType;
  salePrice: number | null;
  unitCost: number | null;
  targetCount: number;
  productCount: number;
  futureSalesOnly: boolean;
};

export type FinanceVariantRow = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  explicitCommercialType: FinanceCommercialType | "other" | null;
  commercialType: FinanceCommercialType | "other";
  salePrice: number;
  unitCost: number | null;
  hasCostOverride: boolean;
};

export type FinanceVariantPage = {
  items: FinanceVariantRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function fetchFinanceCategorySettings() {
  return callSupabaseRpc<FinanceCategorySettings>("owner_finance_category_settings");
}

export function applyFinanceCategory(input: {
  commercialType: FinanceCommercialType;
  salePrice?: number | null;
  unitCost?: number | null;
}) {
  return callSupabaseRpc<FinanceCategoryApplyResult>("owner_apply_finance_category", {
    p_commercial_type: input.commercialType,
    p_sale_price: input.salePrice ?? null,
    p_unit_cost: input.unitCost ?? null,
  });
}

export function fetchFinanceVariantTargetsPage(input: {
  query?: string;
  commercialType?: FinanceCommercialType | "other" | "";
  page?: number;
  pageSize?: number;
}) {
  return callSupabaseRpc<FinanceVariantPage>("owner_finance_variant_targets_page", {
    p_query: input.query?.trim() || null,
    p_commercial_type: input.commercialType || null,
    p_page: input.page ?? 1,
    p_page_size: input.pageSize ?? 25,
  });
}

export function saveFinanceVariant(input: {
  variantId: string;
  commercialType?: FinanceCommercialType | "other" | "inherit";
  salePrice?: number | null;
  unitCost?: number | null;
}) {
  const commercialType =
    input.commercialType === undefined
      ? null
      : input.commercialType === "inherit"
        ? ""
        : input.commercialType;

  return callSupabaseRpc<{
    variantId: string;
    productId: string;
    commercialType: FinanceCommercialType | "other";
    salePrice: number;
    unitCost: number | null;
    futureSalesOnly: boolean;
  }>("owner_save_finance_variant", {
    p_variant_id: input.variantId,
    p_commercial_type: commercialType,
    p_sale_price: input.salePrice ?? null,
    p_unit_cost: input.unitCost ?? null,
  });
}
