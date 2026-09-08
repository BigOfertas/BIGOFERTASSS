import { parseCatalogPage, type CatalogListItem } from "@/lib/catalog";
import { attachProductImages } from "@/lib/product-images";
import type {
  CatalogProduct,
  Product,
  ProductCategory,
  ProductImage,
  ProductOption,
  ProductOptionValue,
  ProductVariant,
} from "@/lib/products";
import { isUsableCatalogProduct } from "@/lib/products";
import { callSupabaseRpc } from "@/lib/supabase-rpc";

export interface ProductOptionGroup extends ProductOption {
  values: ProductOptionValue[];
}

export interface ProductVariantWithValues extends ProductVariant {
  optionValueIds: Record<string, string>;
}

export interface ProductDetailData {
  product: CatalogProduct;
  category: ProductCategory | null;
  options: ProductOptionGroup[];
  variants: ProductVariantWithValues[];
}

type ProductDetailRpcPayload = {
  product?: Record<string, unknown> | null;
  category?: ProductCategory | null;
  images?: ProductImage[];
  options?: ProductOptionGroup[];
  variants?: Array<Record<string, unknown> & { optionValueIds?: Record<string, string> }>;
};

const selectionByVariantList = new WeakMap<ProductVariantWithValues[], Record<string, string>>();

function sortByOrderAndName<T extends { sort_order: number }>(
  values: T[],
  getName: (value: T) => string,
) {
  return values.slice().sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return getName(left).localeCompare(getName(right), "pt-BR");
  });
}

export async function fetchProductDetail(identifier: string): Promise<ProductDetailData> {
  const normalizedIdentifier = decodeURIComponent(identifier).trim();
  if (!normalizedIdentifier) throw new Error("Produto indisponível");

  const payload = await callSupabaseRpc<ProductDetailRpcPayload | null>(
    "storefront_product_detail_v1",
    { p_identifier: normalizedIdentifier },
  );

  if (!payload?.product) {
    throw new Error("Produto indisponível");
  }

  const product = { ...payload.product, sku: "" } as Product;
  if (!isUsableCatalogProduct(product)) {
    throw new Error("Produto indisponível");
  }

  const images = (payload.images ?? []) as ProductImage[];
  if (images.length === 0) {
    throw new Error("Produto indisponível");
  }

  const options = sortByOrderAndName(payload.options ?? [], (option) => option.name).map(
    (option) => ({
      ...option,
      values: sortByOrderAndName(option.values ?? [], (value) => value.value),
    }),
  );

  const variants = sortByOrderAndName(
    (payload.variants ?? []).map(
      (variant) =>
        ({
          ...variant,
          sku: "",
          optionValueIds: variant.optionValueIds ?? {},
        }) as ProductVariantWithValues,
    ),
    (variant) => variant.name ?? "",
  );

  return {
    product: attachProductImages(product, images),
    category: payload.category ?? null,
    options,
    variants,
  };
}

export function getVariantBasePrice(product: Product, variant: ProductVariant) {
  return variant.price_override ?? product.price;
}

export function getVariantPromotionalPrice(product: Product, variant: ProductVariant) {
  const basePrice = getVariantBasePrice(product, variant);
  const candidate =
    variant.promotional_price_override ??
    (variant.price_override === null ? product.promotional_price : null);

  return candidate !== null && candidate >= 0 && candidate < basePrice ? candidate : null;
}

export function getVariantEffectivePrice(product: Product, variant: ProductVariant) {
  return getVariantPromotionalPrice(product, variant) ?? getVariantBasePrice(product, variant);
}

export function getDefaultProductVariant(variants: ProductVariantWithValues[]) {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0] ?? null;

  const hasRealChoice = variants.some((variant) => Object.keys(variant.optionValueIds).length > 0);
  if (hasRealChoice) return null;

  return variants.find((variant) => variant.is_default) ?? variants[0] ?? null;
}

export function findVariantForSelection(
  variants: ProductVariantWithValues[],
  selection: Record<string, string>,
  requiredOptionIds: string[],
) {
  selectionByVariantList.set(variants, { ...selection });

  const matchingVariant = variants.find((variant) =>
    Object.entries(selection).every(
      ([optionId, valueId]) => variant.optionValueIds[optionId] === valueId,
    ),
  );

  if (requiredOptionIds.some((optionId) => !selection[optionId])) {
    return matchingVariant ?? null;
  }

  return matchingVariant ?? null;
}

export function isValueCompatibleWithSelection(
  variants: ProductVariantWithValues[],
  optionId: string,
  valueId: string,
  selection: Record<string, string>,
) {
  const rememberedSelection = selectionByVariantList.get(variants) ?? {};
  const sourceSelection = Object.keys(selection).length > 0 ? selection : rememberedSelection;
  const candidateSelection = { ...sourceSelection };

  delete candidateSelection[optionId];
  candidateSelection[optionId] = valueId;

  return variants.some((variant) =>
    Object.entries(candidateSelection).every(
      ([candidateOptionId, candidateValueId]) =>
        variant.optionValueIds[candidateOptionId] === candidateValueId,
    ),
  );
}

export async function fetchRelatedProducts(
  product: Product,
  categorySlug: string | null,
): Promise<CatalogListItem[]> {
  const scope = product.time_key
    ? { time: product.time_key }
    : categorySlug
      ? { category: categorySlug }
      : product.liga_key
        ? { liga: product.liga_key }
        : product.campeonato_key
          ? { campeonato: product.campeonato_key }
          : null;

  if (!scope) {
    return [];
  }

  const data = await callSupabaseRpc<Parameters<typeof parseCatalogPage>[0]>(
    "catalog_products_page_v3",
    {
      p_query: null,
      p_category: "category" in scope ? scope.category : null,
      p_campeonato: "campeonato" in scope ? scope.campeonato : null,
      p_liga: "liga" in scope ? scope.liga : null,
      p_time: "time" in scope ? scope.time : null,
      p_season: null,
      p_brand: null,
      p_audience: null,
      p_commercial_type: null,
      p_min_price: null,
      p_max_price: null,
      p_sort: "newest",
      p_page: 1,
      p_page_size: 12,
    },
  );

  return parseCatalogPage(data)
    .items.filter((item) => item.id !== product.id)
    .slice(0, 8);
}
