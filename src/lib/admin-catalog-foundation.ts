import { callSupabaseRpc } from "@/lib/supabase-rpc";

export type AdminCatalogStatus = "draft" | "active" | "inactive" | "archived";
export type AdminVariantStatus = "active" | "inactive" | "archived";

export type AdminCatalogListItem = {
  id: string;
  name: string;
  status: AdminCatalogStatus;
  category: string | null;
  competition: string | null;
  team: string | null;
  season: string | null;
  brand: string | null;
  audience: string | null;
  price: number;
  promotionalPrice: number | null;
  variantCount: number;
  readyImageCount: number;
  updatedAt: string;
};

export type AdminCatalogPage = {
  items: AdminCatalogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminTaxonomyItem = {
  id: string;
  kind: "competition" | "team" | "brand" | "season" | "audience";
  name: string;
  slug: string;
  context: "club" | "national" | "other" | null;
  storageField: "campeonato" | "liga" | null;
  parents: Array<{ id: string; name: string; slug: string }>;
};

export type AdminTaxonomySnapshot = {
  items: AdminTaxonomyItem[];
  categories: Array<{ id: string; name: string; slug: string }>;
};

export type AdminVariantOption = {
  optionId?: string;
  name: string;
  kind: "size" | "color" | "version" | "gender" | "other";
  valueId?: string;
  value: string;
};

export type AdminCatalogVariant = {
  id: string;
  name: string | null;
  status: AdminVariantStatus;
  isDefault: boolean;
  sortOrder: number;
  priceOverride: number | null;
  promotionalPriceOverride: number | null;
  stockQuantity: number;
  options: AdminVariantOption[];
};

export type AdminCatalogImage = {
  id: string;
  variantId: string | null;
  storageKey: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
  status: "ready";
};

export type AdminCatalogProductDetail = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotionalPrice: number | null;
  status: AdminCatalogStatus;
  primaryCategoryId: string | null;
  category: string | null;
  campeonato: string | null;
  liga: string | null;
  time: string | null;
  season: string | null;
  brand: string | null;
  audience: string | null;
  commercialType:
    | "torcedor"
    | "feminino"
    | "jogador"
    | "retro"
    | "infantil"
    | "calcao"
    | "basquete"
    | "other";
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  variants: AdminCatalogVariant[];
  images: AdminCatalogImage[];
};

export type SaveAdminCatalogProductInput = {
  id: string | null;
  name: string;
  description: string;
  price: number;
  promotionalPrice: number | null;
  status: AdminCatalogStatus;
  primaryCategoryId: string | null;
  campeonato: string;
  liga: string;
  time: string;
  season: string;
  brand: string;
  audience: string;
  commercialType: AdminCatalogProductDetail["commercialType"];
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
};

export function fetchAdminCatalogPage(input: {
  query?: string;
  status?: AdminCatalogStatus | "";
  page?: number;
  pageSize?: number;
}) {
  return callSupabaseRpc<AdminCatalogPage>("owner_catalog_products_page", {
    p_query: input.query?.trim() || null,
    p_status: input.status || null,
    p_page: input.page ?? 1,
    p_page_size: input.pageSize ?? 25,
  });
}

export function fetchAdminCatalogTaxonomy() {
  return callSupabaseRpc<AdminTaxonomySnapshot>("owner_catalog_taxonomy");
}

export function upsertAdminCatalogTaxonomy(input: {
  kind: AdminTaxonomyItem["kind"];
  name: string;
  context?: AdminTaxonomyItem["context"];
  storageField?: AdminTaxonomyItem["storageField"];
  parentId?: string | null;
}) {
  return callSupabaseRpc<string>("owner_upsert_catalog_taxonomy", {
    p_kind: input.kind,
    p_name: input.name,
    p_context: input.context ?? null,
    p_storage_field: input.storageField ?? null,
    p_parent_id: input.parentId ?? null,
  });
}

export function fetchAdminCatalogProductDetail(productId: string) {
  return callSupabaseRpc<AdminCatalogProductDetail>("owner_catalog_product_detail", {
    p_product_id: productId,
  });
}

export function saveAdminCatalogProduct(input: SaveAdminCatalogProductInput) {
  return callSupabaseRpc<string>("owner_save_catalog_product", {
    p_product_id: input.id,
    p_name: input.name,
    p_description: input.description,
    p_price: input.price,
    p_promotional_price: input.promotionalPrice,
    p_status: input.status,
    p_primary_category_id: input.primaryCategoryId,
    p_campeonato: input.campeonato,
    p_liga: input.liga,
    p_time: input.time,
    p_season: input.season,
    p_brand: input.brand,
    p_audience: input.audience,
    p_commercial_type: input.commercialType,
    p_weight_grams: input.weightGrams,
    p_length_cm: input.lengthCm,
    p_width_cm: input.widthCm,
    p_height_cm: input.heightCm,
  });
}

export function saveAdminCatalogVariant(input: {
  productId: string;
  variantId: string | null;
  name: string;
  status: AdminVariantStatus;
  isDefault: boolean;
  priceOverride: number | null;
  promotionalPriceOverride: number | null;
  stockQuantity: number;
  options: AdminVariantOption[];
}) {
  return callSupabaseRpc<string>("owner_save_catalog_variant", {
    p_product_id: input.productId,
    p_variant_id: input.variantId,
    p_name: input.name,
    p_status: input.status,
    p_is_default: input.isDefault,
    p_price_override: input.priceOverride,
    p_promotional_price_override: input.promotionalPriceOverride,
    p_stock_quantity: input.stockQuantity,
    p_options: input.options.map((option, sortOrder) => ({ ...option, sortOrder })),
  });
}

export function assignAdminCatalogImageVariant(input: {
  productId: string;
  imageId: string;
  variantId: string | null;
}) {
  return callSupabaseRpc<void>("owner_assign_catalog_image_variant", {
    p_product_id: input.productId,
    p_image_id: input.imageId,
    p_variant_id: input.variantId,
  });
}
