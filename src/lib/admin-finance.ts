import { callSupabaseRpc } from "@/lib/supabase-rpc";

export type FinancialPeriod = "today" | "7d" | "30d" | "month" | "previous_month" | "year";

export type FinancialSummary = {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  orders: number;
  units: number;
  share5: number;
};

export type FinancialTrendPoint = {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
};

export type FinancialPerformanceRow = {
  id: string;
  name: string;
  category: string;
  units: number;
  baseRevenue: number;
  addOnRevenue: number;
  discounts: number;
  productCost: number;
  addOnCost: number;
  cost: number;
  revenue: number;
  profit: number;
  margin: number;
  share5: number;
};

export type FinancialDashboardSnapshot = {
  period: FinancialPeriod;
  periodStart: string;
  periodEnd: string;
  summary: FinancialSummary;
  trend: FinancialTrendPoint[];
  products: FinancialPerformanceRow[];
  categories: FinancialPerformanceRow[];
  excludedOrders: number;
};

export type FinanceSettings = {
  personalizationPrice: number;
  personalizationCost: number;
  phrasePrice: number;
  phraseCost: number;
  patchPrice: number;
  patchCost: number;
  profitSharePercent: number;
  activatedAt: string;
};

export type FinanceProductRow = {
  productId: string;
  name: string;
  sku: string | null;
  commercialType: string;
  salePrice: number;
  unitCost: number | null;
  costConfigured: boolean;
  isManualCost: boolean;
  financialCategory: string;
};

export type FinanceProductsPage = {
  items: FinanceProductRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function fetchFinancialDashboard(period: FinancialPeriod) {
  return callSupabaseRpc<FinancialDashboardSnapshot>("owner_get_financial_dashboard", {
    p_period: period,
    p_from: null,
    p_to: null,
  });
}

export function fetchFinanceSettings() {
  return callSupabaseRpc<FinanceSettings>("owner_get_finance_settings");
}

export function saveFinanceSettings(input: {
  personalizationPrice: number;
  personalizationCost: number;
  phrasePrice: number;
  phraseCost: number;
  patchPrice: number;
  patchCost: number;
}) {
  return callSupabaseRpc<FinanceSettings>("owner_save_finance_settings", {
    p_personalization_price: input.personalizationPrice,
    p_personalization_cost: input.personalizationCost,
    p_phrase_price: input.phrasePrice,
    p_phrase_cost: input.phraseCost,
    p_patch_price: input.patchPrice,
    p_patch_cost: input.patchCost,
  });
}

export function fetchFinanceProductsPage(query: string, page: number, pageSize = 20) {
  return callSupabaseRpc<FinanceProductsPage>("owner_finance_products_page", {
    p_query: query || null,
    p_page: page,
    p_page_size: pageSize,
  });
}

export function saveProductFinance(productId: string, unitCost: number) {
  return callSupabaseRpc<{
    productId: string;
    unitCost: number;
    salePrice: number;
    financialCategory: string;
    isManualCost: boolean;
  }>("owner_save_product_finance", {
    p_product_id: productId,
    p_unit_cost: unitCost,
  });
}
