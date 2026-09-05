import { z } from "zod";

import type { Json } from "@/integrations/supabase/types";
import { buildR2PublicImageUrl } from "@/lib/product-images";

export const CATALOG_DEFAULT_PAGE_SIZE = 24;
export const CATALOG_PAGE_SIZES = [12, 24, 48] as const;

export const catalogSortSchema = z.enum([
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
]);

export type CatalogSort = z.infer<typeof catalogSortSchema>;

export interface CatalogQuery {
  q?: string;
  campeonato?: string;
  liga?: string;
  time?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: CatalogSort;
  page?: number;
  pageSize?: (typeof CATALOG_PAGE_SIZES)[number];
}

export interface CatalogListItem {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price: number;
  promotional_price: number | null;
  stock: number;
  category: string | null;
  campeonato: string | null;
  liga: string | null;
  time: string | null;
  commercial_type: string | null;
  created_at: string;
  image_storage_key: string | null;
  fallback_image_url: string | null;
  displayImageUrl: string | null;
}

export interface CatalogPage {
  items: CatalogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CatalogFacetOption {
  value: string;
  label: string;
  count: number;
}

export interface CatalogFacets {
  categories: CatalogFacetOption[];
  campeonatos: CatalogFacetOption[];
  ligas: CatalogFacetOption[];
  times: CatalogFacetOption[];
  priceMin: number;
  priceMax: number;
}

const catalogItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  slug: z.string(),
  name: z.string(),
  price: z.coerce.number().nonnegative(),
  promotional_price: z.coerce.number().nonnegative().nullable(),
  stock: z.coerce.number().int().nonnegative(),
  category: z.string().nullable(),
  campeonato: z.string().nullable(),
  liga: z.string().nullable(),
  time: z.string().nullable(),
  commercial_type: z.string().nullable().optional().default(null),
  created_at: z.string(),
  image_storage_key: z.string().nullable(),
  fallback_image_url: z.string().nullable(),
});

const catalogPageSchema = z.object({
  items: z.array(catalogItemSchema),
  total: z.coerce.number().int().nonnegative(),
  page: z.coerce.number().int().positive(),
  pageSize: z.coerce.number().int().min(1).max(48),
  totalPages: z.coerce.number().int().nonnegative(),
});

const facetOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.coerce.number().int().nonnegative(),
});

const catalogFacetsSchema = z.object({
  categories: z.array(facetOptionSchema),
  campeonatos: z.array(facetOptionSchema),
  ligas: z.array(facetOptionSchema),
  times: z.array(facetOptionSchema),
  priceMin: z.coerce.number().nonnegative(),
  priceMax: z.coerce.number().nonnegative(),
});

export function parseCatalogPage(value: Json): CatalogPage {
  const parsed = catalogPageSchema.parse(value);

  return {
    ...parsed,
    items: parsed.items.map((item) => ({
      ...item,
      displayImageUrl:
        (item.image_storage_key
          ? buildR2PublicImageUrl(item.image_storage_key)
          : null) ?? item.fallback_image_url,
    })),
  };
}

export function parseCatalogFacets(value: Json): CatalogFacets {
  return catalogFacetsSchema.parse(value);
}

export function normalizeCatalogQuery(query: CatalogQuery): Required<
  Pick<CatalogQuery, "sort" | "page" | "pageSize">
> & CatalogQuery {
  const pageSize = CATALOG_PAGE_SIZES.includes(
    query.pageSize as (typeof CATALOG_PAGE_SIZES)[number],
  )
    ? query.pageSize
    : CATALOG_DEFAULT_PAGE_SIZE;

  return {
    ...query,
    sort: query.sort ?? "newest",
    page: Math.max(1, query.page ?? 1),
    pageSize: pageSize ?? CATALOG_DEFAULT_PAGE_SIZE,
  };
}

export function withoutPage(query: CatalogQuery): CatalogQuery {
  const next = { ...query };
  delete next.page;
  return next;
}
