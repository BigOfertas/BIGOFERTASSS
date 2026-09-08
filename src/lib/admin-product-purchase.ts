import { callSupabaseRpc } from "@/lib/supabase-rpc";
import type { ProductCommercialType } from "@/lib/product-purchase";

export type PurchaseGlobalAdmin = {
  sizes: string[];
  personalizationPrice: number;
  personalizationNameMax: number;
  phrasePrice: number;
  phraseMax: number;
  patchDefaultPrice: number;
  patchCatalog: Array<{ code: string; label: string }>;
  productionBusinessDays: number;
  deliveryMinBusinessDays: number;
  deliveryMaxBusinessDays: number;
  productTypePrices: Record<string, number>;
};

export type PurchaseProductAdmin = {
  productId: string;
  name: string;
  price: number;
  commercialType: ProductCommercialType;
  sizeEnabled: boolean;
  personalizationEnabled: boolean;
  phraseEnabled: boolean;
  patches: Array<{ code: string; enabled?: boolean; price?: number | null }>;
};

export type PurchaseProductPage = {
  items: PurchaseProductAdmin[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function fetchPurchaseGlobal() {
  return callSupabaseRpc<PurchaseGlobalAdmin>("owner_get_store_purchase_settings");
}

export function fetchPurchaseProductsPage(input: {
  query?: string;
  page?: number;
  pageSize?: number;
}) {
  return callSupabaseRpc<PurchaseProductPage>("owner_purchase_products_page", {
    p_query: input.query?.trim() || null,
    p_page: input.page ?? 1,
    p_page_size: input.pageSize ?? 25,
  });
}

export function fetchProductPurchaseAdmin(productId: string) {
  return callSupabaseRpc<PurchaseProductAdmin>("owner_get_product_purchase_settings", {
    p_product_id: productId,
  });
}

export function savePurchaseGlobal(input: PurchaseGlobalAdmin) {
  return callSupabaseRpc<PurchaseGlobalAdmin>("owner_save_store_purchase_settings_v2", {
    p_personalization_price: input.personalizationPrice,
    p_personalization_name_max: input.personalizationNameMax,
    p_phrase_price: input.phrasePrice,
    p_phrase_max: input.phraseMax,
    p_patch_default_price: input.patchDefaultPrice,
    p_production_business_days: input.productionBusinessDays,
    p_delivery_min_business_days: input.deliveryMinBusinessDays,
    p_delivery_max_business_days: input.deliveryMaxBusinessDays,
    p_product_type_prices: input.productTypePrices,
  });
}

export function saveProductPurchaseSettings(input: PurchaseProductAdmin) {
  return callSupabaseRpc<PurchaseProductAdmin>("owner_save_product_purchase_settings_v2", {
    p_product_id: input.productId,
    p_commercial_type: input.commercialType,
    p_size_enabled: input.sizeEnabled,
    p_personalization_enabled: input.personalizationEnabled,
    p_phrase_enabled: input.phraseEnabled,
    p_patches: input.patches,
  });
}
