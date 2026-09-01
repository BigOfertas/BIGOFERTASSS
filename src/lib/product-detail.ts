import { supabase } from "@/integrations/supabase/client";
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
  ProductVariantValue,
} from "@/lib/products";
import { isUsableCatalogProduct } from "@/lib/products";

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function fetchActiveProduct(identifier: string) {
  const normalizedIdentifier = decodeURIComponent(identifier).trim();

  const query = supabase
    .from("products")
    .select("*")
    .eq("status", "active");

  const { data, error } = UUID_PATTERN.test(normalizedIdentifier)
    ? await query.eq("id", normalizedIdentifier).maybeSingle()
    : await query.eq("slug", normalizedIdentifier).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || !isUsableCatalogProduct(data)) {
    throw new Error("Produto indisponível");
  }

  return data;
}

export async function fetchProductDetail(
  identifier: string,
): Promise<ProductDetailData> {
  const product = await fetchActiveProduct(identifier);

  const [imagesResult, optionsResult, variantsResult] = await Promise.all([
    supabase
      .from("product_images")
      .select("*")
      .eq("product_id", product.id)
      .eq("status", "ready")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("product_options")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", product.id)
      .eq("status", "active")
      .order("sort_order", { ascending: true })
      .order("sku", { ascending: true }),
  ]);

  if (imagesResult.error) throw imagesResult.error;
  if (optionsResult.error) throw optionsResult.error;
  if (variantsResult.error) throw variantsResult.error;

  const options = sortByOrderAndName(
    (optionsResult.data ?? []) as ProductOption[],
    (option) => option.name,
  );
  const variants = sortByOrderAndName(
    (variantsResult.data ?? []) as ProductVariant[],
    (variant) => variant.name ?? variant.sku,
  );

  const optionIds = options.map((option) => option.id);
  const variantIds = variants.map((variant) => variant.id);

  let optionValues: ProductOptionValue[] = [];
  if (optionIds.length > 0) {
    const { data, error } = await supabase
      .from("product_option_values")
      .select("*")
      .in("option_id", optionIds)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("value", { ascending: true });

    if (error) throw error;
    optionValues = (data ?? []) as ProductOptionValue[];
  }

  let variantValues: ProductVariantValue[] = [];
  if (variantIds.length > 0) {
    const { data, error } = await supabase
      .from("product_variant_values")
      .select("*")
      .in("variant_id", variantIds);

    if (error) throw error;
    variantValues = (data ?? []) as ProductVariantValue[];
  }

  let category: ProductCategory | null = null;
  if (product.primary_category_id) {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("id", product.primary_category_id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw error;
    category = (data as ProductCategory | null) ?? null;
  }

  const valuesByOption = new Map<string, ProductOptionValue[]>();
  for (const value of optionValues) {
    const values = valuesByOption.get(value.option_id) ?? [];
    values.push(value);
    valuesByOption.set(value.option_id, values);
  }

  const valuesByVariant = new Map<string, Record<string, string>>();
  for (const relation of variantValues) {
    const selection = valuesByVariant.get(relation.variant_id) ?? {};
    selection[relation.option_id] = relation.option_value_id;
    valuesByVariant.set(relation.variant_id, selection);
  }

  return {
    product: attachProductImages(
      product,
      (imagesResult.data ?? []) as ProductImage[],
    ),
    category,
    options: options.map((option) => ({
      ...option,
      values: sortByOrderAndName(
        valuesByOption.get(option.id) ?? [],
        (value) => value.value,
      ),
    })),
    variants: variants.map((variant) => ({
      ...variant,
      optionValueIds: valuesByVariant.get(variant.id) ?? {},
    })),
  };
}

export function getVariantBasePrice(product: Product, variant: ProductVariant) {
  return variant.price_override ?? product.price;
}

export function getVariantPromotionalPrice(
  product: Product,
  variant: ProductVariant,
) {
  const basePrice = getVariantBasePrice(product, variant);
  const candidate =
    variant.promotional_price_override ??
    (variant.price_override === null ? product.promotional_price : null);

  return candidate !== null && candidate >= 0 && candidate < basePrice
    ? candidate
    : null;
}

export function getVariantEffectivePrice(
  product: Product,
  variant: ProductVariant,
) {
  return getVariantPromotionalPrice(product, variant) ?? getVariantBasePrice(product, variant);
}

export function getDefaultProductVariant(
  variants: ProductVariantWithValues[],
) {
  return variants.find((variant) => variant.is_default) ?? variants[0] ?? null;
}

export function findVariantForSelection(
  variants: ProductVariantWithValues[],
  selection: Record<string, string>,
  requiredOptionIds: string[],
) {
  if (requiredOptionIds.some((optionId) => !selection[optionId])) {
    return null;
  }

  return (
    variants.find((variant) =>
      Object.entries(selection).every(
        ([optionId, valueId]) => variant.optionValueIds[optionId] === valueId,
      ),
    ) ?? null
  );
}

export function isValueCompatibleWithSelection(
  variants: ProductVariantWithValues[],
  optionId: string,
  valueId: string,
  selection: Record<string, string>,
) {
  const candidateSelection = { ...selection, [optionId]: valueId };

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

  const { data, error } = await supabase.rpc("catalog_products_page", {
    p_query: null,
    p_category: "category" in scope ? scope.category : null,
    p_campeonato: "campeonato" in scope ? scope.campeonato : null,
    p_liga: "liga" in scope ? scope.liga : null,
    p_time: "time" in scope ? scope.time : null,
    p_min_price: null,
    p_max_price: null,
    p_sort: "newest",
    p_page: 1,
    p_page_size: 12,
  });

  if (error) {
    throw error;
  }

  return parseCatalogPage(data).items
    .filter((item) => item.id !== product.id)
    .slice(0, 8);
}
