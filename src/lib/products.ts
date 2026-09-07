import type { Tables } from "@/integrations/supabase/types";
import type { CatalogQuery } from "@/lib/catalog";

export type Product = Tables<"products">;
export type ProductCategory = Tables<"categories">;
export type ProductImage = Tables<"product_images">;
export type ProductOption = Tables<"product_options">;
export type ProductOptionValue = Tables<"product_option_values">;
export type ProductVariant = Tables<"product_variants">;
export type ProductVariantValue = Tables<"product_variant_values">;

export type CatalogProduct = Product & {
  images: ProductImage[];
  displayImageUrl: string | null;
};

export type ProductSearchFilters = CatalogQuery;

const KNOWN_FICTITIOUS_PRODUCT_NAME = "Camisa Profissional BIGofertas 2024";

export function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeFilterValue(value: string | null | undefined) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

export function matchesFilter(
  productValue: string | null | undefined,
  filterValue: string | undefined,
) {
  if (!filterValue) {
    return true;
  }

  return normalizeFilterValue(productValue) === normalizeFilterValue(filterValue);
}

export function matchesTextSearch(product: Product, query: string | undefined) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableText = normalizeSearchText(
    [
      product.name,
      product.sku,
      product.slug,
      product.description,
      product.category,
      product.campeonato,
      product.liga,
      product.time,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return normalizedQuery.split(/\s+/).every((term) => searchableText.includes(term));
}

export function hasPromotionalPrice(product: Pick<Product, "price" | "promotional_price">) {
  return (
    product.promotional_price !== null &&
    Number.isFinite(product.promotional_price) &&
    product.promotional_price >= 0 &&
    product.promotional_price < product.price
  );
}

export function getEffectiveProductPrice(product: Pick<Product, "price" | "promotional_price">) {
  return hasPromotionalPrice(product) ? (product.promotional_price as number) : product.price;
}

export function isKnownFictitiousProduct(product: Pick<Product, "name" | "image_url">) {
  return (
    typeof product.name === "string" &&
    typeof product.image_url === "string" &&
    product.name === KNOWN_FICTITIOUS_PRODUCT_NAME &&
    product.image_url.includes("placehold.co")
  );
}

export function isUsableCatalogProduct(product: Product) {
  return (
    Boolean(product.id) &&
    Boolean(product.name.trim()) &&
    Boolean(product.sku.trim()) &&
    Boolean(product.slug.trim()) &&
    product.status === "active" &&
    Number.isFinite(product.price) &&
    product.price >= 0 &&
    (product.promotional_price === null || hasPromotionalPrice(product)) &&
    Number.isInteger(product.stock) &&
    product.stock >= 0 &&
    !isKnownFictitiousProduct(product)
  );
}
