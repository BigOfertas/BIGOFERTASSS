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
  sku: string;
  price: number;
  commercialType: ProductCommercialType;
  sizeEnabled: boolean;
  personalizationEnabled: boolean;
  phraseEnabled: boolean;
  patches: Array<{ code: string; enabled?: boolean; price?: number | null }>;
};

export type PurchaseAdminSnapshot = {
  global: PurchaseGlobalAdmin;
  products: PurchaseProductAdmin[];
};

export function fetchPurchaseAdminSnapshot() {
  return callSupabaseRpc<PurchaseAdminSnapshot>("owner_get_product_purchase_admin");
}

export function savePurchaseGlobal(input: PurchaseGlobalAdmin) {
  return callSupabaseRpc<PurchaseAdminSnapshot>("owner_save_store_purchase_settings", {
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
  return callSupabaseRpc<PurchaseAdminSnapshot>("owner_save_product_purchase_settings", {
    p_product_id: input.productId,
    p_commercial_type: input.commercialType,
    p_size_enabled: input.sizeEnabled,
    p_personalization_enabled: input.personalizationEnabled,
    p_phrase_enabled: input.phraseEnabled,
    p_patches: input.patches,
  });
}
